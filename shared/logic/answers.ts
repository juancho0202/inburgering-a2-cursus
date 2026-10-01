/** Trim, collapse spaces, lower-case, strip accents. */
export function normalizeAnswer(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function matchesAny(input: string, accepted: string[]): boolean {
  const n = normalizeAnswer(input);
  return n !== "" && accepted.some((a) => normalizeAnswer(a) === n);
}

export function checkWordOrder(placed: string[], tokens: string[], alsoAccepted: string[][] = []): boolean {
  const same = (a: string[], b: string[]) => a.length === b.length && a.every((t, i) => t === b[i]);
  return same(placed, tokens) || alsoAccepted.some((alt) => same(placed, alt));
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}

/** Strip a leading article so "de huur" also accepts "huur". */
export function stripArticle(word: string): string {
  return word.replace(/^(de|het|een)\s+/i, "");
}
