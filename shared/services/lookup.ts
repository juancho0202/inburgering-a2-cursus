import { buildExerciseIndex } from "../content/exerciseIndex.js";
import { examExercises, examQuestions } from "../logic/exam.js";
import type { Exercise } from "../types.js";
import type { Env } from "./context.js";

/**
 * Finds an exercise by id: unit exercises, visible Claude-made ones, reading sub-questions and exam items.
 * (Exam items are only found here, never in practice sessions, so exams stay unseen.)
 */
export async function findExercise(env: Env, id: string): Promise<Exercise | undefined> {
  const index = buildExerciseIndex(env.content, await env.store.generated.all());
  const parent = index.resolve(id)?.exercise;
  if (parent) return parent.type === "reading" && parent.id !== id ? parent.questions.find((q) => q.id === id) : parent;
  for (const exam of env.content.exams.values()) {
    const q = examQuestions(exam).find((x) => x.id === id);
    if (q) return q.exercise;
    const item = examExercises(exam).find((x) => x.id === id);
    if (item) return item;
  }
  return undefined;
}

export async function findWritingExercise(env: Env, id: string): Promise<Extract<Exercise, { type: "writing" }> | undefined> {
  const ex = await findExercise(env, id);
  return ex?.type === "writing" ? ex : undefined;
}
