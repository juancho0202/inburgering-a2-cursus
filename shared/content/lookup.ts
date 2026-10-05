import type { Exercise } from "../types.js";
import { examExercises, examQuestions } from "../logic/exam.js";
import type { Content } from "./types.js";

/** Finds an exercise (or reading sub-question) by id in the course, including exam items. */
export function findExerciseInContent(content: Content, id: string): Exercise | undefined {
  for (const unit of content.units.values()) {
    for (const step of unit.steps) {
      if (step.type !== "exercise") continue;
      if (step.exercise.id === id) return step.exercise;
      if (step.exercise.type === "reading") {
        const q = step.exercise.questions.find((x) => x.id === id);
        if (q) return q;
      }
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
