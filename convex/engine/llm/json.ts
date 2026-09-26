// Find the JSON answer in model text. Free models often wrap it in a code
// fence or write reasoning before it, so try the fence first, then each
// balanced {...} block from the last one back.

function balancedObjects(text: string): string[] {
  const found: string[] = [];
  for (let start = text.indexOf("{"); start !== -1; start = text.indexOf("{", start + 1)) {
    let depth = 0;
    let inString = false;
    let escaped = false;
    for (let i = start; i < text.length; i += 1) {
      const char = text[i];
      if (inString) {
        if (escaped) escaped = false;
        else if (char === "\\") escaped = true;
        else if (char === '"') inString = false;
        continue;
      }
      if (char === '"') inString = true;
      else if (char === "{") depth += 1;
      else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          found.push(text.slice(start, i + 1));
          break;
        }
      }
    }
  }
  return found;
}

/** Returns the parsed JSON values in the text, best candidate first. */
export function jsonCandidates(text: string): unknown[] {
  const candidates: string[] = [];
  for (const match of text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) candidates.push(match[1].trim());
  candidates.push(...balancedObjects(text).reverse());
  const values: unknown[] = [];
  for (const candidate of candidates) {
    try {
      values.push(JSON.parse(candidate));
    } catch {
      // Not JSON: try the next candidate.
    }
  }
  return values;
}
