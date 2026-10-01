import { Router } from "express";
import { z } from "zod";
import { AttemptSchema, defaultProgress, defaultSrs } from "../../shared/schemas/progress.js";
import { dayString } from "../../shared/logic/srs.js";
import { hardItemIds, weakestTags } from "../../shared/logic/weakspots.js";
import { loadProgress, saveProgress, appendAttempt, saveSrs, loadSrs } from "../db/progressRepo.js";
import { getContent, buildExerciseIndex } from "../db/contentRepo.js";
import { recordActivity } from "../db/activity.js";
import { introduceCards } from "./srs.js";

export const progressRouter = Router();

const bad = (message: string) => ({ error: { code: "invalid_body", message } });

progressRouter.get("/progress", async (_req, res) => {
  res.json(await loadProgress());
});

progressRouter.post("/attempts", async (req, res) => {
  const parsed = AttemptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(bad("Dit antwoord kon niet worden opgeslagen."));
    return;
  }
  const attempt = parsed.data;
  await appendAttempt(attempt);

  const progress = await loadProgress();
  const existing = progress.items[attempt.itemId] ?? { seen: 0, correct: 0, lastCorrect: null, lastSeenAt: null };
  progress.items[attempt.itemId] = {
    seen: existing.seen + 1,
    correct: existing.correct + (attempt.correct ? 1 : 0),
    lastCorrect: attempt.correct,
    lastSeenAt: new Date().toISOString(),
  };
  recordActivity(progress, attempt.durationMs);
  await saveProgress(progress);
  res.json({ ok: true });
});

const StepSchema = z.object({ stepIndex: z.number().int().min(0) });

progressRouter.post("/units/:unitId/step", async (req, res) => {
  const parsed = StepSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(bad("De stap kon niet worden opgeslagen."));
    return;
  }
  const { unitId } = req.params;
  const progress = await loadProgress();
  const existing = progress.units[unitId];
  progress.units[unitId] = {
    status: existing?.status ?? "in_progress",
    bestScore: existing?.bestScore ?? null,
    attempts: existing?.attempts ?? 0,
    stepIndex: parsed.data.stepIndex,
    completedAt: existing?.completedAt ?? null,
  };
  progress.lastLocation = { unitId, stepIndex: parsed.data.stepIndex };
  progress.lastActivityAt = new Date().toISOString();
  await saveProgress(progress);
  res.json({ ok: true });
});

const CompleteUnitSchema = z.object({ score: z.number().min(0).max(1) });

progressRouter.post("/units/:unitId/complete", async (req, res) => {
  const parsed = CompleteUnitSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(bad("De score kon niet worden opgeslagen."));
    return;
  }
  const content = await getContent();
  const unit = content.units.get(req.params.unitId);
  const progress = await loadProgress();
  const now = new Date().toISOString();
  const existing = progress.units[req.params.unitId];
  progress.units[req.params.unitId] = {
    status: "completed",
    bestScore: Math.max(existing?.bestScore ?? 0, parsed.data.score),
    attempts: (existing?.attempts ?? 0) + 1,
    stepIndex: 0,
    completedAt: now,
  };
  progress.lastLocation = null;
  progress.lastActivityAt = now;
  await saveProgress(progress);

  const introduced = unit ? await introduceCards(unit.vocabRefs) : 0;
  res.json({ ok: true, wordsIntroduced: introduced });
});

progressRouter.get("/dashboard", async (_req, res) => {
  const content = await getContent();
  const progress = await loadProgress();
  const srs = await loadSrs();
  const today = dayString(new Date());
  const index = buildExerciseIndex(content);

  const modules = [...content.modules.values()].map((mod) => {
    const done = mod.units.filter((id) => progress.units[id]?.status === "completed").length;
    return { id: mod.id, title: mod.title, icon: mod.icon, total: mod.units.length, completed: done };
  });

  const lastLoc = progress.lastLocation;
  const lastUnit = lastLoc ? content.units.get(lastLoc.unitId) : undefined;
  const dueCount = Object.values(srs.cards).filter((c) => c.reps > 0 && c.due <= today).length;
  const newCount = Object.values(srs.cards).filter((c) => c.reps === 0).length;

  res.json({
    lastLocation: lastLoc && lastUnit ? { unitId: lastUnit.id, unitTitle: lastUnit.title, stepIndex: lastLoc.stepIndex, stepCount: lastUnit.steps.length } : null,
    dailyGoalMinutes: progress.dailyGoalMinutes,
    minutesToday: Math.round((progress.minutesByDay[today] ?? 0) * 10) / 10,
    streak: progress.streak,
    dueCount,
    newCount,
    modules,
    hardCount: hardItemIds(progress.items).length,
    weakTags: weakestTags(progress.items, (id) => index.resolve(id)?.tags ?? []),
    nextExam: [...content.exams.values()].find((e) => !progress.exams.some((r) => r.examId === e.id && r.finishedAt))?.id ?? null,
  });
});

/** Mixed practice session: hardest items, or items with a given tag. */
progressRouter.get("/practice", async (req, res) => {
  const content = await getContent();
  const progress = await loadProgress();
  const index = buildExerciseIndex(content);
  const tag = typeof req.query.tag === "string" ? req.query.tag : null;
  const unitId = typeof req.query.unit === "string" ? req.query.unit : null;
  const limit = Math.min(Number(req.query.limit ?? 12), 30);

  let ids: string[];
  if (tag) {
    ids = [...index.byId.values()].filter((r) => r.tags.includes(tag)).map((r) => r.exercise.id);
    ids.sort((a, b) => accuracy(progress, a) - accuracy(progress, b));
  } else {
    ids = hardItemIds(progress.items)
      .map((id) => index.resolve(id)?.exercise.id)
      .filter((id): id is string => !!id && (!unitId || index.byId.get(id)?.unitId === unitId));
  }
  const unique = [...new Set(ids)].slice(0, limit);
  res.json(unique.map((id) => index.byId.get(id)!.exercise));
});

function accuracy(progress: Awaited<ReturnType<typeof loadProgress>>, id: string): number {
  const p = progress.items[id];
  return p && p.seen > 0 ? p.correct / p.seen : 0.5;
}

progressRouter.post("/progress/reset", async (req, res) => {
  const parsed = z.object({ confirm: z.literal("RESET") }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json(bad("Bevestig met RESET om door te gaan."));
    return;
  }
  await saveProgress(defaultProgress());
  await saveSrs(defaultSrs());
  res.json({ ok: true });
});
