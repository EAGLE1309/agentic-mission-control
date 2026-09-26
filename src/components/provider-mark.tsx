import { IconFlask } from "@tabler/icons-react";
import Composio from "@thesvg/react/composio";
import Github from "@thesvg/react/github";
import Google from "@thesvg/react/google";
import JinaAi from "@thesvg/react/jina-ai";
import Nvidia from "@thesvg/react/nvidia";
import OpenRouter from "@thesvg/react/openrouter";
import Qwen from "@thesvg/react/qwen";
import Tavily from "@thesvg/react/tavily";
import { cn } from "@/lib/utils";

// Brand marks of model providers and services (design §4.1): original brand
// colors. A brand with light and dark marks shows the one for the theme. A
// brand with no mark of its own gets a letter tile.

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
  simulated: "Scripted",
  tavily: "Tavily",
  jina: "Jina AI",
  github: "GitHub",
  composio: "Composio",
};

/** The display name of a brand key ("qwen", "tavily"), or of the provider of a model ID. */
export function providerName(modelIdOrBrand: string): string {
  const key = modelIdOrBrand.split("/")[0] ?? modelIdOrBrand;
  return PROVIDER_NAMES[key] ?? key.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

/**
 * A model name for people: the catalog name without its provider prefix and
 * "(free)", or a name made from the ID.
 */
export function modelName(modelId: string, catalogName?: string | null): string {
  if (modelId.startsWith("simulated/")) return "Simulated model";
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

/** The mark of the provider of a model ID. */
export function ProviderMark({ modelId, className }: { modelId: string; className?: string }) {
  return <BrandMark brand={modelId.split("/")[0] ?? modelId} className={className} />;
}

/** A brand mark by key: model providers, tool services, and sign-in providers. */
export function BrandMark({ brand, className }: { brand: string; className?: string }) {
  const size = cn("size-4 shrink-0", className);
  switch (brand) {
    case "tavily":
      return <Tavily variant="color" aria-hidden className={size} />;
    case "jina":
      return <JinaAi aria-hidden className={cn(size, "text-foreground")} />;
    case "github":
      return <Github variant="mono" aria-hidden className={cn(size, "text-foreground")} />;
    case "composio":
      // The mark is white only, so it sits on its brand's black tile.
      return (
        <span aria-hidden className={cn("flex items-center justify-center rounded-[4px] bg-[oklch(0.18_0_0)]", size)}>
          <Composio className="size-[70%]" />
        </span>
      );
    case "simulated":
      return <IconFlask aria-hidden className={cn(size, "text-muted-foreground")} />;
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
          {providerName(brand).charAt(0)}
        </span>
      );
  }
}
