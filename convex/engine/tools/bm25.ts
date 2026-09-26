import { CHUNK_CHARS } from "../../../src/shared/constants";

// Page chunks ranked with BM25 (tech spec §7.5 steps 3 to 5). Free models
// often have small context windows, so only the best chunks go to the model.

const STOPWORDS = new Set(
  "a an and are as at be but by for from has have how in is it its of on or that the their this to was were what when where which who why will with you your about into than then them they these those".split(
    " ",
  ),
);

export function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) ?? []).filter((token) => !STOPWORDS.has(token));
}

/** Split text into chunks of about CHUNK_CHARS, at paragraph and then sentence edges. */
export function chunkText(text: string, size = CHUNK_CHARS): string[] {
  const pieces: string[] = [];
  for (const paragraph of text.split(/\n{2,}/)) {
    const clean = paragraph.trim();
    if (!clean) continue;
    if (clean.length <= size) {
      pieces.push(clean);
      continue;
    }
    // A long paragraph: split at sentences, and cut a sentence that is still too long.
    for (const sentence of clean.split(/(?<=[.!?])\s+/)) {
      for (let start = 0; start < sentence.length; start += size) pieces.push(sentence.slice(start, start + size));
    }
  }
  const chunks: string[] = [];
  let current = "";
  for (const piece of pieces) {
    if (current && current.length + piece.length + 2 > size) {
      chunks.push(current);
      current = "";
    }
    current = current ? `${current}\n\n${piece}` : piece;
  }
  if (current) chunks.push(current);
  return chunks;
}

/**
 * The chunks that best match the query, in page order, up to maxChars.
 * With no query words, the first chunks.
 */
export function rankChunks(chunks: string[], query: string, maxChars: number): string[] {
  const terms = [...new Set(tokenize(query))];
  const docs = chunks.map((chunk) => tokenize(chunk));
  let order = chunks.map((_, index) => index);

  if (terms.length > 0 && chunks.length > 1) {
    const k1 = 1.2;
    const b = 0.75;
    const averageLength = docs.reduce((sum, doc) => sum + doc.length, 0) / Math.max(1, docs.length);
    const documentFrequency = new Map(terms.map((term) => [term, docs.filter((doc) => doc.includes(term)).length]));
    const scores = docs.map((doc) => {
      const counts = new Map<string, number>();
      for (const token of doc) counts.set(token, (counts.get(token) ?? 0) + 1);
      let score = 0;
      for (const term of terms) {
        const frequency = counts.get(term) ?? 0;
        if (frequency === 0) continue;
        const df = documentFrequency.get(term) ?? 0;
        const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
        score += (idf * frequency * (k1 + 1)) / (frequency + k1 * (1 - b + (b * doc.length) / Math.max(1, averageLength)));
      }
      return score;
    });
    order = order.sort((a, c) => scores[c] - scores[a] || a - c);
  }

  const picked: number[] = [];
  let total = 0;
  for (const index of order) {
    const length = chunks[index].length;
    if (total + length > maxChars) {
      if (picked.length === 0) {
        picked.push(index);
        total = maxChars;
      }
      continue;
    }
    picked.push(index);
    total += length;
  }
  return picked.sort((a, c) => a - c).map((index) => (chunks[index].length > maxChars ? chunks[index].slice(0, maxChars) : chunks[index]));
}
