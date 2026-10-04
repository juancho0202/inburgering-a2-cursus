import type { WritingFeedback } from "../schemas/claude.js";

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "fix"; original: string; corrected: string; index: number };

/**
 * Splits the learner's text into plain and corrected parts. Each correction is matched at its
 * first free occurrence; corrections that cannot be found (or overlap) are skipped here and
 * are still listed separately in the UI.
 */
export function buildSegments(text: string, corrections: WritingFeedback["corrections"]): Segment[] {
  const found: { start: number; end: number; index: number }[] = [];
  corrections.forEach((c, index) => {
    if (!c.original.trim()) return;
    let from = 0;
    while (from <= text.length) {
      const start = text.indexOf(c.original, from);
      if (start === -1) return;
      const end = start + c.original.length;
      if (!found.some((f) => start < f.end && end > f.start)) {
        found.push({ start, end, index });
        return;
      }
      from = start + 1;
    }
  });
  found.sort((a, b) => a.start - b.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const f of found) {
    if (f.start > cursor) segments.push({ kind: "text", text: text.slice(cursor, f.start) });
    const c = corrections[f.index];
    segments.push({ kind: "fix", original: c.original, corrected: c.corrected, index: f.index });
    cursor = f.end;
  }
  if (cursor < text.length) segments.push({ kind: "text", text: text.slice(cursor) });
  return segments;
}

/** Progress tag for a correction type, e.g. "writing:woordvolgorde". */
export const writingTag = (type: string) => `writing:${type.replace("/", "-")}`;

/** Which grammar tag to practise for a writing error tag. */
export function practiceTagFor(tag: string): string {
  switch (tag) {
    case "writing:woordvolgorde":
      return "grammar:zinsbouw";
    case "writing:werkwoord":
      return "grammar:tegenwoordig";
    case "writing:lidwoord":
      return "grammar:lidwoord";
    default:
      return "schrijven:basis";
  }
}
