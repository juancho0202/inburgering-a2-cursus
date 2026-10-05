import { Router } from "express";
import { z } from "zod";
import type { Exam, Progress } from "../../shared/types.js";
import {
  POINTS_PER_WRITING_TASK,
  examExercises,
  examQuestions,
  gradeExam,
  isAnswered,
  remainingMs,
} from "../../shared/logic/exam.js";
import { matchesAny } from "../../shared/logic/answers.js";
import { getContent } from "../db/contentRepo.js";
import { loadProgress, saveProgress, saveWritingSubmission } from "../db/progressRepo.js";
import { recordActivity } from "../db/activity.js";

export const examsRouter = Router();

const fail = (res: import("express").Response, status: number, code: string, message: string) =>
  res.status(status).json({ error: { code, message } });

type ExamResult = Progress["exams"][number];

/** Re-computes score and max for a Schrijven exam from the per-task points. */
export function summarizeWriting(result: ExamResult): void {
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

const questionCount = (exam: Exam) => (exam.skill === "schrijven" ? examExercises(exam).length : examQuestions(exam).length);

examsRouter.get("/exams", async (_req, res) => {
  const content = await getContent();
  const progress = await loadProgress();
  res.json(
    [...content.exams.values()].map((exam) => {
      const results = progress.exams.filter((r) => r.examId === exam.id);
      const open = results.find((r) => !r.finishedAt);
      return {
        id: exam.id,
        skill: exam.skill,
        title: exam.title,
        durationMinutes: exam.durationMinutes,
        passScore: exam.passScore,
        questionCount: questionCount(exam),
        inProgress: open ? { id: open.id, startedAt: open.startedAt } : null,
        attempts: results
          .filter((r) => r.finishedAt)
          .map((r) => ({ id: r.id, finishedAt: r.finishedAt, score: r.score, max: r.max })),
      };
    }),
  );
});

// Result routes come before /exams/:id so "results" is not read as an exam id.
examsRouter.get("/exams/results/:rid", async (req, res) => {
  const progress = await loadProgress();
  const result = progress.exams.find((r) => r.id === req.params.rid);
  if (!result) return fail(res, 404, "not_found", "Dit resultaat bestaat niet.");
  res.json(result);
});

const StateBody = z.object({
  answers: z.record(z.string(), z.unknown()),
  flagged: z.array(z.string()).default([]),
  position: z.number().int().min(0).default(0),
});

/** Saves the exam state continuously, so a refresh can resume. */
examsRouter.put("/exams/results/:rid/state", async (req, res) => {
  const body = StateBody.safeParse(req.body);
  if (!body.success) return fail(res, 400, "invalid_body", "De antwoorden konden niet worden opgeslagen.");
  const progress = await loadProgress();
  const result = progress.exams.find((r) => r.id === req.params.rid);
  if (!result) return fail(res, 404, "not_found", "Dit examen bestaat niet.");
  if (result.finishedAt) return fail(res, 409, "finished", "Dit examen is al ingeleverd.");
  Object.assign(result, body.data);
  await saveProgress(progress);
  res.json({ ok: true });
});

examsRouter.post("/exams/results/:rid/submit", async (req, res) => {
  const progress = await loadProgress();
  const result = progress.exams.find((r) => r.id === req.params.rid);
  if (!result) return fail(res, 404, "not_found", "Dit examen bestaat niet.");
  const content = await getContent();
  const exam = content.exams.get(result.examId);
  if (!exam) return fail(res, 404, "not_found", "Dit examen bestaat niet.");
  if (result.finishedAt) return res.json(result); // already handed in

  const body = StateBody.partial().safeParse(req.body);
  if (body.success && body.data.answers) result.answers = body.data.answers;
  const answers = result.answers;
  const now = new Date();
  result.finishedAt = now.toISOString();

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
        const submission = { id: `w-${Date.now()}-${item.id.slice(-3)}`, exerciseId: item.id, text, submittedAt: now.toISOString(), feedback: null };
        if (text.trim()) await saveWritingSubmission(submission);
        result.details[item.id] = { kind: "writing", submissionId: text.trim() ? submission.id : null };
        // An empty text scores zero; otherwise the points come from Claude feedback later.
        if (!text.trim()) result.details[item.id] = { kind: "writing", submissionId: null, points: 0, max: POINTS_PER_WRITING_TASK };
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
      const prev = progress.items[q.id] ?? { seen: 0, correct: 0, lastCorrect: null, lastSeenAt: null };
      progress.items[q.id] = { seen: prev.seen + 1, correct: prev.correct + (grade.correct[q.id] ? 1 : 0), lastCorrect: grade.correct[q.id], lastSeenAt: now.toISOString() };
    }
  }

  const elapsed = Math.min(now.getTime() - Date.parse(result.startedAt), exam.durationMinutes * 60_000);
  recordActivity(progress, elapsed, now, exam.durationMinutes * 60_000);
  await saveProgress(progress);
  res.json(result);
});

examsRouter.get("/exams/:id", async (req, res) => {
  const content = await getContent();
  const exam = content.exams.get(req.params.id);
  if (!exam) return fail(res, 404, "not_found", "Dit examen bestaat niet.");
  res.json(exam);
});

/** Starts an exam, or returns the unfinished attempt so the learner can resume. */
examsRouter.post("/exams/:id/start", async (req, res) => {
  const content = await getContent();
  const exam = content.exams.get(req.params.id);
  if (!exam) return fail(res, 404, "not_found", "Dit examen bestaat niet.");
  const progress = await loadProgress();
  let result = progress.exams.find((r) => r.examId === exam.id && !r.finishedAt);
  if (!result) {
    const startedAt = new Date().toISOString();
    result = { id: `r-${Date.now()}`, examId: exam.id, startedAt, finishedAt: null, score: 0, max: 0, answers: {}, flagged: [], position: 0, details: {} };
    progress.exams.push(result);
    progress.lastActivityAt = startedAt;
    await saveProgress(progress);
  }
  res.json({ result, remainingMs: remainingMs(result.startedAt, exam.durationMinutes) });
});

/** The questions answered wrong (or not at all) in a finished attempt, for "Oefen je fouten". */
examsRouter.get("/exams/results/:rid/mistakes", async (req, res) => {
  const progress = await loadProgress();
  const result = progress.exams.find((r) => r.id === req.params.rid);
  const exam = result && (await getContent()).exams.get(result.examId);
  if (!result || !exam) return fail(res, 404, "not_found", "Dit resultaat bestaat niet.");
  const wrong = examQuestions(exam).filter((q) => (result.details[q.id] as { correct?: boolean } | undefined)?.correct === false);
  res.json(wrong.map((q) => q.exercise));
});
