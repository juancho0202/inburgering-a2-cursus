import type { Content } from "../shared/content/types.js";
import { parseProgressFile } from "../shared/services/transfer.js";
import { findExerciseInContent } from "../shared/content/lookup.js";

export interface FlagLine {
  id: string;
  itemId: string;
  note: string;
  at: string;
  device: string | null;
}

/** Collects the "Meld een fout" notes from one or more progress files (the same note in two files counts once). */
export function collectFlags(files: unknown[]): FlagLine[] {
  const seen = new Map<string, FlagLine>();
  for (const raw of files) {
    const { file } = parseProgressFile(raw);
    for (const f of file.data.flags) if (!seen.has(f.id)) seen.set(f.id, { ...f, device: file.device.name });
  }
  return [...seen.values()].sort((a, b) => a.itemId.localeCompare(b.itemId) || a.at.localeCompare(b.at));
}

function describe(content: Content, itemId: string): string {
  const ex = findExerciseInContent(content, itemId);
  if (ex) return ex.prompt;
  for (const unit of content.units.values()) {
    const lesson = unit.steps.find((s) => s.type === "lesson" && s.id === itemId);
    if (lesson && lesson.type === "lesson") return `Les: ${lesson.title}`;
  }
  return "(onderdeel bestaat niet meer)";
}

/** A readable list for the content author, grouped by item. */
export function formatFlags(flags: FlagLine[], content: Content): string {
  if (!flags.length) return "Geen meldingen gevonden.";
  const byItem = new Map<string, FlagLine[]>();
  for (const f of flags) byItem.set(f.itemId, [...(byItem.get(f.itemId) ?? []), f]);
  const lines = [`${flags.length} melding(en) over ${byItem.size} onderdeel/onderdelen:`, ""];
  for (const [itemId, list] of byItem) {
    lines.push(`## ${itemId}`, `   ${describe(content, itemId)}`);
    for (const f of list) lines.push(`   - ${f.note || "(geen toelichting)"}  [${f.at.slice(0, 10)}${f.device ? `, ${f.device}` : ""}]`);
    lines.push("");
  }
  return lines.join("\n");
}
