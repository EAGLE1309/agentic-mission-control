import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalAction } from "../_generated/server";
import { appSpec, isAppSlug } from "../../src/shared/apps";
import { TOOL_CALL_TIMEOUT_MS } from "../../src/shared/constants";
import { preview, type Source } from "../../src/shared/events";
import { SAVE_ID } from "../../src/shared/plan";
import { emit, errorMessage, previewWithArtifact, saveArtifact } from "./emit";
import { withTimeout } from "./gate";
import { runAppTool, type ToolOutcome } from "./tools/registry";

// The save step: after the assembler, the finished report goes to the app of
// the plan (saveTo). The engine sends the report text itself, so no model can
// shorten or change it, and a failed save never fails the report.

/** The page title and the body without its "# " title line, which the app shows as the title. */
function splitReport(markdown: string, fallback: string): { title: string; body: string } {
  const match = /^#\s+(.+)\n+/.exec(markdown.trimStart());
  if (!match) return { title: fallback, body: markdown.trim() };
  return { title: match[1].trim().slice(0, 200) || fallback, body: markdown.trimStart().slice(match[0].length).trim() };
}

export const run = internalAction({
  args: { missionId: v.id("missions") },
  handler: async (ctx, { missionId }): Promise<{ ok: boolean }> => {
    const context = await ctx.runQuery(internal.engine.state.saveContext, { missionId });
    if (!context) return { ok: true };
    if (context.stopped) return { ok: false };

    const { saveTo } = context;
    const name = isAppSlug(saveTo.app) ? appSpec(saveTo.app).name : saveTo.app;
    const fail = async (error: string) => {
      await emit(ctx, missionId, [{ type: "node_failed", nodeId: SAVE_ID, payload: { error, retryable: false, attempt: 1 } }]);
      return { ok: false };
    };

    await emit(ctx, missionId, [{ type: "node_started", nodeId: SAVE_ID, payload: { attempt: 1, model: "" } }]);
    const app = context.apps.find((item) => item.slug === saveTo.app);
    if (!context.report) return await fail("There is no report to save.");
    if (!app?.write) return await fail(`${name} does not allow creating items now. Allow it on the Integrations page, then run the mission again.`);

    const { version, words } = context.report;
    const { title, body } = splitReport(context.report.markdown, context.title ?? "Report");
    await emit(ctx, missionId, [
      { type: "thought", nodeId: SAVE_ID, payload: { step: 1, text: `Saving report v${version} to ${name}.` } },
    ]);

    // A follow-up can save the same version again, so the call ID has the time too.
    const callId = `${SAVE_ID}#v${version}-${Date.now().toString(36)}`;
    const inputText = JSON.stringify(
      { app: app.slug, title, ...(saveTo.target ? { target: saveTo.target } : {}), content: `Report v${version}, ${words} words` },
      null,
      2,
    );
    await emit(ctx, missionId, [{ type: "tool_call", nodeId: SAVE_ID, payload: { callId, tool: "app_write", inputPreview: preview(inputText) } }]);

    const started = Date.now();
    let outcome: ToolOutcome;
    try {
      outcome = await withTimeout(
        runAppTool(
          context.mode,
          "app_write",
          { app: app.slug, title, content: body, ...(saveTo.target ? { target: saveTo.target } : {}) },
          { ctx, seed: `${missionId}:${SAVE_ID}:${version}`, focusFallback: "", userId: context.userId, apps: context.apps },
        ),
        TOOL_CALL_TIMEOUT_MS,
        `${name} did not answer in time.`,
      );
    } catch (error) {
      const message = errorMessage(error);
      outcome = { ok: false, output: `Error: ${message}`, fullText: "", error: message };
    }

    const url = outcome.ok ? (/^URL: (\S+)/m.exec(outcome.fullText)?.[1] ?? null) : null;
    const output = outcome.ok
      ? await previewWithArtifact(ctx, { missionId, nodeId: SAVE_ID, kind: "tool_output", text: outcome.fullText })
      : { preview: preview(outcome.error ?? outcome.output), artifactId: undefined };
    await emit(ctx, missionId, [
      {
        type: "tool_result",
        nodeId: SAVE_ID,
        payload: {
          callId,
          ok: outcome.ok,
          outputPreview: output.preview,
          ...(output.artifactId ? { outputArtifactId: output.artifactId } : {}),
          durationMs: Math.round(Date.now() - started),
          ...(outcome.ok ? {} : { error: outcome.error ?? "The save failed." }),
          ...(url ? { urls: [url] } : {}),
        },
      },
    ]);
    if (!outcome.ok) return await fail(outcome.error ?? "The save failed.");

    const parent = /^Parent page: (.+)$/m.exec(outcome.fullText)?.[1];
    const summary = `Saved report v${version} to ${name}${parent ? ` under “${parent}”` : ""}.`;
    const sources: Source[] = url ? [{ title, url }] : [];
    if (url) await ctx.runMutation(internal.engine.state.recordSave, { missionId, app: app.slug, url, title, version });
    const outputArtifactId = await saveArtifact(ctx, {
      missionId,
      nodeId: SAVE_ID,
      kind: "node_output",
      text: [summary, url ? `\n[${title}](${url})` : ""].join(""),
    });
    await emit(ctx, missionId, [{ type: "node_done", nodeId: SAVE_ID, payload: { summary, outputArtifactId, sources } }]);
    return { ok: true };
  },
});
