/** Full-width ASCII (Ａ-Ｚ, ０-９, ！ …) → half-width; ideographic space → space. */
export function toHalfWidth(s: string): string {
  return s
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, ' ');
}

/** Strip Steam BBCode, URLs, emoji and box-drawing "ASCII art" from review text. */
export function cleanReview(text: string): string {
  return text
    .replace(/\[\/?[a-z0-9*]+(?:=[^\]]*)?\]/gi, ' ') // [h1] [/spoiler] [url=…]
    .replace(/https?:\/\/\S+/gi, ' ')
    .replace(/[─-▟⠀-⣿]/g, ' ') // box drawing, blocks, braille art
    .replace(/\p{Extended_Pictographic}/gu, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

export function normalizeForTerms(text: string): string {
  return toHalfWidth(cleanReview(text)).toLowerCase();
}

/** Split into sentences on Chinese and Latin terminators and line breaks. */
export function splitSentences(text: string): string[] {
  return cleanReview(text)
    .split(/(?<=[。！？!?；;…])|(?<=\.)\s+|\n+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
