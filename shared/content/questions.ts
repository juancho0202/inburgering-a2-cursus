import type { Exercise } from "../types.js";

/** An exercise built around a text (reading) or a recording (listening), with questions about it. */
export type WithQuestions = Extract<Exercise, { type: "reading" | "listening" }>;

export const hasQuestions = (ex: Exercise): ex is WithQuestions => ex.type === "reading" || ex.type === "listening";

/** The questions about the text or recording; none for any other exercise. */
export const subQuestions = (ex: Exercise): Exercise[] => (hasQuestions(ex) ? ex.questions : []);
