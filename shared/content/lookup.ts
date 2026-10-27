import type { Exercise } from "../types.js";
import { examExercises, examQuestions } from "../logic/exam.js";
import type { Content } from "./types.js";
import { subQuestions } from "./questions.js";

/** Finds an exercise (or a question about a text or fragment) by id in the course, including exam items. */
export function findExerciseInContent(content: Content, id: string): Exercise | undefined {
  for (const unit of content.units.values()) {
    for (const step of unit.steps) {
      if (step.type !== "exercise") continue;
      if (step.exercise.id === id) return step.exercise;
      const q = subQuestions(step.exercise).find((x) => x.id === id);
      if (q) return q;
    }
  }
  for (const exam of content.exams.values()) {
    const q = examQuestions(exam).find((x) => x.id === id);
    if (q) return q.exercise;
    const item = examExercises(exam).find((x) => x.id === id);
    if (item) return item;
  }
  return undefined;
}

/**
 * Where an item lives under data/course, with a short readable title (exercise prompt or lesson title).
 * Unit and exam files are named after their id (checked when the course is built).
 * Null for anything that is not in the course files, such as exercises made by Claude.
 */
export function findItemSource(content: Content, id: string): { file: string; title: string } | null {
  for (const unit of content.units.values()) {
    const file = `${unit.moduleId}/units/${unit.id}.json`;
    for (const step of unit.steps) {
      if (step.type === "lesson") {
        if (step.id === id) return { file, title: `Les: ${step.title}` };
        continue;
      }
      if (step.exercise.id === id) return { file, title: step.exercise.prompt };
      const q = subQuestions(step.exercise).find((x) => x.id === id);
      if (q) return { file, title: q.prompt };
    }
  }
  for (const exam of content.exams.values()) {
    const file = `exams/${exam.id}.json`;
    const q = examQuestions(exam).find((x) => x.id === id);
    if (q) return { file, title: q.exercise.prompt };
    const item = examExercises(exam).find((x) => x.id === id);
    if (item) return { file, title: item.prompt };
  }
  return null;
}
