import type { Exam, Exercise } from "../types.js";

export interface ExamQuestion {
  id: string;
  /** Top-level item (page) this question belongs to. */
  itemId: string;
  exercise: Exercise;
  tags: string[];
}

/** Exam items that are real exercises (we do not use `ref` items). */
export function examExercises(exam: Exam): Exercise[] {
  return exam.items.filter((i): i is Exercise => "type" in i);
}

/** Gradable multiple-choice questions, with reading sub-questions flattened. */
export function examQuestions(exam: Exam): ExamQuestion[] {
  const out: ExamQuestion[] = [];
  for (const item of examExercises(exam)) {
    if (item.type === "reading") {
      for (const q of item.questions) out.push({ id: q.id, itemId: item.id, exercise: q, tags: q.tags.length ? q.tags : item.tags });
    } else if (item.type === "mc") out.push({ id: item.id, itemId: item.id, exercise: item, tags: item.tags });
  }
  return out;
}

/** Selected option indexes as a sorted array (answers are stored as number[]). */
export function selectedIndexes(answer: unknown): number[] {
  if (typeof answer === "number") return [answer];
  if (Array.isArray(answer)) return answer.filter((v): v is number => typeof v === "number").sort((a, b) => a - b);
  return [];
}

export function isAnswered(answer: unknown): boolean {
  return selectedIndexes(answer).length > 0;
}

/** Group key for the breakdown: knm:<theme> or lezen:<type>. */
export const themeOf = (tags: string[]): string | null => tags.find((t) => /^(knm|lezen):/.test(t)) ?? null;

export interface GradeResult {
  score: number;
  max: number;
  byTheme: Record<string, [number, number]>;
  correct: Record<string, boolean>;
}

export function gradeExam(exam: Exam, answers: Record<string, unknown>): GradeResult {
  const byTheme: Record<string, [number, number]> = {};
  const correct: Record<string, boolean> = {};
  let score = 0;
  const qs = examQuestions(exam);
  for (const q of qs) {
    const ex = q.exercise;
    const picked = selectedIndexes(answers[q.id]);
    const ok = ex.type === "mc" && picked.length === 1 && picked[0] === ex.answer;
    correct[q.id] = ok;
    if (ok) score++;
    const theme = themeOf(q.tags);
    if (theme) {
      const t = (byTheme[theme] ??= [0, 0]);
      t[1]++;
      if (ok) t[0]++;
    }
  }
  return { score, max: qs.length, byTheme, correct };
}

/** Milliseconds left, from the wall clock, so a refresh keeps the timer honest. */
export function remainingMs(startedAt: string, durationMinutes: number, now = Date.now()): number {
  return Math.max(0, Date.parse(startedAt) + durationMinutes * 60_000 - now);
}

export const POINTS_PER_WRITING_TASK = 10;
