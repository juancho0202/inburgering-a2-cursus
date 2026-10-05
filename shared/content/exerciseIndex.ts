import type { Exercise } from "../types.js";
import { examQuestions } from "../logic/exam.js";
import type { GeneratedRecord } from "../schemas/store.js";
import type { Content } from "./types.js";

export interface ExerciseRef {
  exercise: Exercise;
  unitId: string;
  tags: string[];
}

/**
 * Index of every practice exercise by id: unit exercises plus the visible Claude-made ones.
 * Reading sub-questions resolve to their parent. Exam questions are NOT included (exams must stay unseen).
 */
export function buildExerciseIndex(content: Content, generated: GeneratedRecord[] = []) {
  const byId = new Map<string, ExerciseRef>();
  const parentOf = new Map<string, string>();
  const add = (ex: Exercise, unitId: string, unitTags: string[]) => {
    byId.set(ex.id, { exercise: ex, unitId, tags: [...new Set([...unitTags, ...ex.tags])] });
    if (ex.type === "reading") for (const q of ex.questions) parentOf.set(q.id, ex.id);
  };
  for (const unit of content.units.values()) {
    for (const step of unit.steps) if (step.type === "exercise") add(step.exercise, unit.id, unit.tags);
  }
  for (const g of generated) {
    if (!g.hidden) add(g.exercise, g.unitId, content.units.get(g.unitId)?.tags ?? []);
  }
  const resolve = (id: string) => byId.get(parentOf.get(id) ?? id);
  return { byId, resolve };
}

/** question id → tags, for the weak-spot calculation of exam answers. */
export function examTagIndex(content: Content): Map<string, string[]> {
  return new Map([...content.exams.values()].flatMap((e) => examQuestions(e).map((q) => [q.id, q.tags] as const)));
}
