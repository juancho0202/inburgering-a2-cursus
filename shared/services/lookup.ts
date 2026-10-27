import { buildExerciseIndex } from "../content/exerciseIndex.js";
import { hasQuestions } from "../content/questions.js";
import { examExercises, examQuestions } from "../logic/exam.js";
import type { Exercise } from "../types.js";
import type { Env } from "./context.js";

/**
 * Finds an exercise by id: unit exercises, visible Claude-made ones, questions about a text or fragment, and exam items.
 * (Exam items are only found here, never in practice sessions, so exams stay unseen.)
 */
export async function findExercise(env: Env, id: string): Promise<Exercise | undefined> {
  const index = buildExerciseIndex(env.content, await env.store.generated.all());
  const parent = index.resolve(id)?.exercise;
  if (parent) return hasQuestions(parent) && parent.id !== id ? parent.questions.find((q) => q.id === id) : parent;
  for (const exam of env.content.exams.values()) {
    const q = examQuestions(exam).find((x) => x.id === id);
    if (q) return q.exercise;
    const item = examExercises(exam).find((x) => x.id === id);
    if (item) return item;
  }
  return undefined;
}

/** The exercise a question about a text or fragment belongs to (in a lesson or an exam). */
export async function findParent(env: Env, questionId: string): Promise<Exercise | undefined> {
  const index = buildExerciseIndex(env.content, await env.store.generated.all());
  const parent = index.resolve(questionId)?.exercise;
  if (parent) return parent.id !== questionId ? parent : undefined;
  for (const exam of env.content.exams.values()) {
    const q = examQuestions(exam).find((x) => x.id === questionId);
    if (q && q.itemId !== questionId) return examExercises(exam).find((i) => i.id === q.itemId);
  }
  return undefined;
}

export async function findWritingExercise(env: Env, id: string): Promise<Extract<Exercise, { type: "writing" }> | undefined> {
  const ex = await findExercise(env, id);
  return ex?.type === "writing" ? ex : undefined;
}
