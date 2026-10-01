import { Router } from "express";
import { z } from "zod";
import { AttemptSchema } from "../../shared/schemas/progress.js";
import { loadProgress, saveProgress, appendAttempt, loadSrs, saveSrs } from "../db/progressRepo.js";

export const progressRouter = Router();

progressRouter.get("/progress", async (_req, res) => {
  const progress = await loadProgress();
  res.json(progress);
});

progressRouter.post("/attempts", async (req, res) => {
  const parsed = AttemptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_body", message: "Dit antwoord kon niet worden opgeslagen." } });
    return;
  }
  const attempt = parsed.data;
  await appendAttempt(attempt);

  const progress = await loadProgress();
  const now = new Date().toISOString();
  const existing = progress.items[attempt.itemId] ?? { seen: 0, correct: 0, lastCorrect: null, lastSeenAt: null };
  progress.items[attempt.itemId] = {
    seen: existing.seen + 1,
    correct: existing.correct + (attempt.correct ? 1 : 0),
    lastCorrect: attempt.correct,
    lastSeenAt: now,
  };
  progress.lastActivityAt = now;
  await saveProgress(progress);

  res.json({ ok: true });
});

const CompleteUnitSchema = z.object({ score: z.number().min(0).max(1) });

progressRouter.post("/units/:unitId/complete", async (req, res) => {
  const parsed = CompleteUnitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_body", message: "De score kon niet worden opgeslagen." } });
    return;
  }
  const progress = await loadProgress();
  const now = new Date().toISOString();
  const existing = progress.units[req.params.unitId];
  progress.units[req.params.unitId] = {
    status: "completed",
    bestScore: Math.max(existing?.bestScore ?? 0, parsed.data.score),
    attempts: (existing?.attempts ?? 0) + 1,
    stepIndex: existing?.stepIndex ?? 0,
    completedAt: now,
  };
  progress.lastActivityAt = now;
  await saveProgress(progress);
  res.json({ ok: true });
});

progressRouter.get("/srs/due", async (req, res) => {
  const limit = Number(req.query.limit ?? 30);
  const srs = await loadSrs();
  const now = new Date().toISOString();
  const due = Object.values(srs.cards)
    .filter((card) => card.due <= now)
    .slice(0, limit);
  res.json(due);
});

const LEITNER_INTERVALS_DAYS = [0, 1, 2, 4, 8, 16];

const ReviewSchema = z.object({ cardId: z.string(), grade: z.enum(["opnieuw", "moeilijk", "goed", "makkelijk"]) });

progressRouter.post("/srs/review", async (req, res) => {
  const parsed = ReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_body", message: "De beoordeling kon niet worden opgeslagen." } });
    return;
  }
  const srs = await loadSrs();
  const card = srs.cards[parsed.data.cardId];
  if (!card) {
    res.status(404).json({ error: { code: "not_found", message: "Dit woordkaartje bestaat niet." } });
    return;
  }
  const now = new Date();
  if (parsed.data.grade === "opnieuw") {
    card.box = 0;
    card.lapses += 1;
    card.due = now.toISOString();
  } else {
    const delta = parsed.data.grade === "moeilijk" ? 0 : parsed.data.grade === "goed" ? 1 : 2;
    card.box = Math.max(0, Math.min(5, card.box + (delta === 0 ? 0 : delta)));
    const days = LEITNER_INTERVALS_DAYS[card.box] ?? 16;
    const due = new Date(now);
    due.setDate(due.getDate() + Math.max(1, days));
    card.due = due.toISOString();
  }
  card.reps += 1;
  card.lastReviewedAt = now.toISOString();
  await saveSrs(srs);
  res.json(card);
});

progressRouter.post("/progress/reset", async (req, res) => {
  const parsed = z.object({ confirm: z.literal("RESET") }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_body", message: "Bevestig met RESET om door te gaan." } });
    return;
  }
  const { defaultProgress } = await import("../../shared/schemas/progress.js");
  await saveProgress(defaultProgress());
  res.json({ ok: true });
});
