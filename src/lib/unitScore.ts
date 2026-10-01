import type { Progress, Unit } from "@shared/types";

/** Scored item ids of a unit: every question that has a right/wrong answer. */
export function scoredItemIds(unit: Unit): string[] {
  const ids: string[] = [];
  for (const step of unit.steps) {
    if (step.type !== "exercise") continue;
    const ex = step.exercise;
    if (ex.type === "writing") continue;
    if (ex.type === "reading") ids.push(...ex.questions.map((q) => q.id));
    else if (ex.type === "form-fill") {
      if (ex.fields.some((f) => f.expected !== undefined)) ids.push(ex.id);
    } else ids.push(ex.id);
  }
  return ids;
}

export function unitScore(unit: Unit, progress: Progress): { good: number; total: number; score: number } {
  const ids = scoredItemIds(unit);
  const good = ids.filter((id) => progress.items[id]?.lastCorrect === true).length;
  return { good, total: ids.length, score: ids.length ? good / ids.length : 1 };
}
