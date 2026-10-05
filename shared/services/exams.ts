import { z } from "zod";
import { matchesAny } from "../logic/answers.js";
import { POINTS_PER_WRITING_TASK, examExercises, examQuestions, gradeExam, isAnswered, remainingMs } from "../logic/exam.js";
import type { ExamRecord } from "../schemas/store.js";
import type { Exam } from "../types.js";
import { invalid, newId, notFound, now, nowIso, ServiceError, type Env } from "./context.js";
import { addAttempt } from "./progress.js";

const questionCount = (exam: Exam) => (exam.skill === "schrijven" ? examExercises(exam).length : examQuestions(exam).length);

function getExamOrThrow(env: Env, id: string): Exam {
  const exam = env.content.exams.get(id);
  if (!exam) throw notFound("Dit examen bestaat niet.");
  return exam;
}

/** Re-computes score and max of a Schrijven exam from the points per task. Mutates `result`. */
export function summarizeWriting(result: ExamRecord): void {
  let score = 0;
  let max = 0;
  for (const d of Object.values(result.details) as { points?: number; max?: number }[]) {
    if (typeof d?.points === "number") {
      score += d.points;
      max += d.max ?? POINTS_PER_WRITING_TASK;
    }
  }
  result.score = Math.round(score * 10) / 10;
  result.max = max;
}

export async function listExams(env: Env) {
  const results = await env.store.examResults.all();
  return [...env.content.exams.values()].map((exam) => {
    const mine = results.filter((r) => r.examId === exam.id);
    const open = mine.find((r) => !r.finishedAt);
    return {
      id: exam.id,
      skill: exam.skill,
      title: exam.title,
      durationMinutes: exam.durationMinutes,
      passScore: exam.passScore,
      questionCount: questionCount(exam),
      inProgress: open ? { id: open.id, startedAt: open.startedAt } : null,
      attempts: mine
        .filter((r) => r.finishedAt)
        .sort((a, b) => a.finishedAt!.localeCompare(b.finishedAt!))
        .map((r) => ({ id: r.id, finishedAt: r.finishedAt, score: r.score, max: r.max })),
    };
  });
}

export const getExam = (env: Env, id: string) => getExamOrThrow(env, id);

export async function getExamResult(env: Env, rid: string): Promise<ExamRecord> {
  const result = await env.store.examResults.get(rid);
  if (!result) throw notFound("Dit resultaat bestaat niet.");
  return result;
}

/** Starts an exam, or returns the unfinished attempt so the learner can resume. */
export async function startExam(env: Env, examId: string) {
  const exam = getExamOrThrow(env, examId);
  let result = (await env.store.examResults.all()).find((r) => r.examId === exam.id && !r.finishedAt);
  if (!result) {
    const startedAt = nowIso(env);
    result = { id: `r-${newId(env)}`, examId: exam.id, startedAt, finishedAt: null, score: 0, max: 0, answers: {}, flagged: [], position: 0, details: {}, updatedAt: startedAt };
    await env.store.examResults.put(result);
  }
  return { result, remainingMs: remainingMs(result.startedAt, exam.durationMinutes, now(env).getTime()) };
}

const StateSchema = z.object({
  answers: z.record(z.string(), z.unknown()),
  flagged: z.array(z.string()).default([]),
  position: z.number().int().min(0).default(0),
});

/** Saves the exam state continuously, so a refresh can resume. */
export async function saveExamState(env: Env, rid: string, body: unknown): Promise<{ ok: true }> {
  const parsed = StateSchema.safeParse(body);
  if (!parsed.success) throw invalid("De antwoorden konden niet worden opgeslagen.");
  const result = await getExamResult(env, rid);
  if (result.finishedAt) throw new ServiceError(409, "finished", "Dit examen is al ingeleverd.");
  await env.store.examResults.put({ ...result, ...parsed.data, updatedAt: nowIso(env) });
  return { ok: true };
}

export async function submitExam(env: Env, rid: string, body: unknown): Promise<ExamRecord> {
  const result = await getExamResult(env, rid);
  const exam = getExamOrThrow(env, result.examId);
  if (result.finishedAt) return result; // already handed in

  const parsed = StateSchema.partial().safeParse(body);
  if (parsed.success && parsed.data.answers) result.answers = parsed.data.answers;
  const answers = result.answers;
  const finished = now(env);
  result.finishedAt = finished.toISOString();

  if (exam.skill === "schrijven") {
    // Texts are saved as writing submissions first; Claude feedback (if any) is requested afterwards.
    for (const item of examExercises(exam)) {
      if (item.type === "form-fill") {
        const values = Array.isArray(answers[item.id]) ? (answers[item.id] as string[]) : [];
        const graded = item.fields.map((f, i) => ({ f, i })).filter(({ f }) => f.expected !== undefined);
        if (graded.length) {
          const good = graded.filter(({ f, i }) => matchesAny(values[i] ?? "", [f.expected!])).length;
          result.details[item.id] = { kind: "form", points: Math.round((good / graded.length) * POINTS_PER_WRITING_TASK * 10) / 10, max: POINTS_PER_WRITING_TASK };
        } else result.details[item.id] = { kind: "form" };
      } else if (item.type === "writing") {
        const text = typeof answers[item.id] === "string" ? (answers[item.id] as string) : "";
        if (text.trim()) {
          const submissionId = `w-${newId(env)}`;
          await env.store.writing.put({ id: submissionId, exerciseId: item.id, text, submittedAt: finished.toISOString(), feedback: null });
          result.details[item.id] = { kind: "writing", submissionId };
        } else {
          // An empty text scores zero.
          result.details[item.id] = { kind: "writing", submissionId: null, points: 0, max: POINTS_PER_WRITING_TASK };
        }
      }
    }
    summarizeWriting(result);
  } else {
    const grade = gradeExam(exam, answers);
    result.score = grade.score;
    result.max = grade.max;
    result.byTheme = grade.byTheme;
    for (const q of examQuestions(exam)) {
      result.details[q.id] = { correct: grade.correct[q.id], answered: isAnswered(answers[q.id]) };
      await addAttempt(env, { itemId: q.id, exerciseType: "exam", correct: grade.correct[q.id], answer: answers[q.id] ?? null, durationMs: 0 });
    }
  }

  // Study time of the exam: wall-clock time, at most the exam duration (the normal 3-minute cap does not apply).
  const elapsed = Math.min(finished.getTime() - Date.parse(result.startedAt), exam.durationMinutes * 60_000);
  await addAttempt(env, { itemId: exam.id, exerciseType: "exam-time", correct: true, durationMs: Math.max(0, elapsed) });

  result.updatedAt = nowIso(env);
  await env.store.examResults.put(result);
  return result;
}

/** The questions answered wrong (or not at all) in a finished attempt, for "Oefen je fouten". */
export async function examMistakes(env: Env, rid: string) {
  const result = await getExamResult(env, rid);
  const exam = getExamOrThrow(env, result.examId);
  return examQuestions(exam)
    .filter((q) => (result.details[q.id] as { correct?: boolean } | undefined)?.correct === false)
    .map((q) => q.exercise);
}
