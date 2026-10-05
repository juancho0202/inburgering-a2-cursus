import type { ContentData } from "./data.js";

/**
 * Every stable id in the course: modules, units, lessons, exercises (and reading questions), words, verbs,
 * exams and exam questions. Progress files refer to these ids, so they must never disappear or change
 * (see SPEC §6.2). Removing one on purpose is allowed, but must be a conscious step.
 */
export function collectContentIds(data: ContentData): string[] {
  const ids = new Set<string>();
  for (const m of data.modules) ids.add(m.id);
  for (const u of data.units) {
    ids.add(u.id);
    for (const step of u.steps) {
      if (step.type === "lesson") ids.add(step.id);
      else {
        ids.add(step.exercise.id);
        if (step.exercise.type === "reading") for (const q of step.exercise.questions) ids.add(q.id);
      }
    }
  }
  for (const v of data.vocab) for (const e of v.entries) ids.add(e.id);
  for (const v of data.verbs) ids.add(v.id);
  for (const exam of data.exams) {
    ids.add(exam.id);
    for (const item of exam.items) {
      if ("ref" in item) continue;
      ids.add(item.id);
      if (item.type === "reading") for (const q of item.questions) ids.add(q.id);
    }
  }
  return [...ids].sort();
}

/** Ids that were in the baseline but are gone now. */
export const missingIds = (baseline: string[], current: string[]): string[] => {
  const now = new Set(current);
  return baseline.filter((id) => !now.has(id));
};
