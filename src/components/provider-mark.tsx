import { IconFlask } from "@tabler/icons-react";
import Composio from "@thesvg/react/composio";
import Exa from "@thesvg/react/exa";
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
  linkup: "Linkup",
  exa: "Exa",
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

// The Linkup symbol from its wordmark (linkup.so). @thesvg/react has no Linkup mark.
const LINKUP_PATH =
  "M56.6892 2.61664C67.8582 2.61684 77.1793 7.71825 84.781 15.5776C88.0682 18.9762 91.0588 22.9132 93.7762 27.228C104.401 23.0473 114.967 21.6447 124.191 25.4291C132.889 28.9978 137.887 35.3697 140.054 43.1752C142.17 50.7958 141.558 59.6258 139.565 68.4243C138.865 71.517 137.982 74.6474 136.964 77.7709C140.968 77.475 144.695 77.3371 148.064 77.3862C153.176 77.4607 157.696 77.9636 161.164 79.1215C167.622 81.2779 169.695 89.2321 165 94.2309C161.907 97.5235 156.626 101.198 148.791 105.166C140.901 109.163 130.214 113.559 116.117 118.211C115.106 118.545 113.998 118.394 113.112 117.804C112.226 117.214 111.66 116.249 111.579 115.187C110.998 107.603 109.851 98.4217 108.034 88.6684C101.345 89.8782 94.3795 91.2986 87.324 92.8745C55.8356 99.9074 22.9587 109.956 5.17557 118.073C4.08854 118.569 2.82227 118.47 1.82596 117.81C0.829922 117.15 0.244053 116.024 0.276157 114.83C0.772462 96.4671 4.03991 68.863 12.3181 45.7289C16.4554 34.1672 21.9264 23.4861 29.1238 15.643C36.3817 7.73412 45.5029 2.61664 56.6892 2.61664ZM147.964 84.311C144.016 84.2534 139.449 84.4717 134.394 84.9321C131.093 93.3925 127.004 101.551 123.008 108.51C132.451 105.105 139.9 101.906 145.662 98.9877C153.21 95.1643 157.665 91.9229 159.951 89.4887C161.153 88.2085 160.683 86.2636 158.97 85.6918C156.5 84.8669 152.811 84.3817 147.964 84.311ZM90.8767 36.0629C79.0105 41.8035 66.4133 51.1487 54.5779 61.6791C42.7679 72.187 31.85 83.7561 23.3435 93.8168C19.0142 98.9372 15.3651 103.601 12.5555 107.494C31.6856 100.097 59.3515 92.0253 85.8152 86.1147C92.8961 84.5332 99.912 83.1017 106.676 81.8764C104.262 70.5887 100.959 58.8674 96.614 48.2026C94.8697 43.9207 92.969 39.8413 90.9099 36.0473C90.899 36.0526 90.8877 36.0576 90.8767 36.0629ZM126.578 85.7866C122.836 86.257 118.914 86.83 114.86 87.4926C115.953 93.3716 116.806 99.0394 117.445 104.287C120.624 98.6872 123.825 92.3537 126.578 85.7866ZM56.6892 9.5434C47.8723 9.5434 40.4941 13.4956 34.2264 20.3256C27.8981 27.2216 22.8156 36.9493 18.8387 48.0629C12.6329 65.4054 9.31837 85.5515 7.93241 102.08C10.7521 98.2536 14.181 93.9263 18.0545 89.3452C26.7384 79.0745 37.8832 67.2624 49.9744 56.5043C61.8852 45.9068 74.8448 36.2142 87.3719 30.0668C85.0284 26.4456 82.5071 23.1883 79.8025 20.392C73.1486 13.5127 65.5231 9.5436 56.6892 9.5434ZM121.562 31.8364C114.875 29.0928 106.622 29.7877 97.2937 33.2944C99.3877 37.2059 101.295 41.3362 103.028 45.5893C107.579 56.7612 111.013 68.9793 113.506 80.6957C119.071 79.7827 124.41 79.0313 129.409 78.476C130.782 74.5991 131.947 70.7055 132.81 66.894C134.682 58.6311 135.063 51.0858 133.382 45.0278C131.751 39.1546 128.161 34.5434 121.562 31.8364Z";

function LinkupMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 -24 170 170" fill="currentColor" aria-hidden className={className}>
      <path d={LINKUP_PATH} />
    </svg>
  );
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
    case "exa":
      return <Exa variant="color" aria-hidden className={size} />;
    case "linkup":
      // The brand mark is black, so it takes the text color and shows in dark mode.
      return <LinkupMark className={cn(size, "text-foreground")} />;
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
