import Google from "@thesvg/react/google";
import Nvidia from "@thesvg/react/nvidia";
import OpenRouter from "@thesvg/react/openrouter";
import Qwen from "@thesvg/react/qwen";
import { cn } from "@/lib/utils";

// Model provider marks (design §4.1): original brand colors. A brand with
// light and dark marks shows the one for the theme. A provider with no mark
// of its own gets a letter tile.

const PROVIDER_NAMES: Record<string, string> = {
  qwen: "Qwen",
  nvidia: "NVIDIA",
  google: "Google",
  openrouter: "OpenRouter",
  thinkingmachines: "Thinking Machines",
  "dots-studio": "Dots Studio",
  inclusionai: "inclusionAI",
  poolside: "Poolside",
  cohere: "Cohere",
  liquid: "Liquid AI",
  "meta-llama": "Meta",
  mistralai: "Mistral",
  deepseek: "DeepSeek",
};

export function providerName(modelId: string): string {
  const key = modelId.split("/")[0] ?? modelId;
  return PROVIDER_NAMES[key] ?? key.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * A model name for people: the catalog name without its provider prefix and
 * "(free)", or a name made from the ID.
 */
export function modelName(modelId: string, catalogName?: string | null): string {
  if (catalogName) {
    const clean = catalogName
      .replace(/^[^:]+:\s*/, "")
      .replace(/\s*\(free\)\s*$/i, "")
      .replace(/\s+/g, " ")
      .trim();
    if (clean) return clean;
  }
  const slug = (modelId.split("/")[1] ?? modelId).replace(/:free$/, "");
  return slug
    .split("-")
    .map((part) => (/^\d+(\.\d+)?[bkm]$/i.test(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)))
    .join(" ");
}

export function ProviderMark({ modelId, className }: { modelId: string; className?: string }) {
  const key = modelId.split("/")[0];
  const size = cn("size-4 shrink-0", className);
  switch (key) {
    case "google":
      return <Google variant="default" aria-hidden className={size} />;
    case "qwen":
      return <Qwen variant="light" aria-hidden className={cn(size, "text-foreground")} />;
    case "nvidia":
      // The full mark carries a wordmark that is unreadable at icon size; the
      // eye alone, in the NVIDIA green, is the brand icon.
      return <Nvidia variant="mono" aria-hidden className={cn(size, "text-[#76B900]")} />;
    case "openrouter":
      return (
        <>
          <OpenRouter variant="light" aria-hidden className={cn(size, "dark:hidden")} />
          <OpenRouter variant="dark" aria-hidden className={cn(size, "hidden dark:block")} />
        </>
      );
    default:
      return (
        <span
          aria-hidden
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-[4px] bg-muted text-xs leading-none font-semibold text-muted-foreground",
            className,
          )}
        >
          {providerName(modelId).charAt(0)}
        </span>
      );
  }
}
