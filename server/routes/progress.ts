import { Router } from "express";
import { z } from "zod";
import { AttemptSchema, defaultProgress, defaultSrs } from "../../shared/schemas/progress.js";
import { dayString } from "../../shared/logic/srs.js";
import { hardItemIds, weakestTags } from "../../shared/logic/weakspots.js";
import { examQuestions } from "../../shared/logic/exam.js";
import { practiceTagFor } from "../../shared/logic/corrections.js";
import { loadProgress, saveProgress, appendAttempt, saveSrs, loadSrs, userDir } from "../db/progressRepo.js";
import { getContent, buildExerciseIndex } from "../db/contentRepo.js";
import { recordActivity } from "../db/activity.js";
import { backupUserFiles } from "../db/fileStore.js";
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
  const examTags = new Map([...content.exams.values()].flatMap((e) => examQuestions(e).map((q) => [q.id, q.tags] as const)));

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
    hardCount: hardItemIds(progress.items).filter((id) => !id.startsWith("writing:")).length,
    // Writing error types (writing:woordvolgorde, ...) are tags of their own.
    weakTags: weakestTags(progress.items, (id) => (id.startsWith("writing:") ? [id] : (index.resolve(id)?.tags ?? examTags.get(id) ?? []))),
    nextExam: (() => {
      const next = [...content.exams.values()].find((e) => !progress.exams.some((r) => r.examId === e.id && r.finishedAt));
      return next ? { id: next.id, title: next.title, skill: next.skill, durationMinutes: next.durationMinutes } : null;
    })(),
  });
});

/** Mixed practice session: hardest items, or items with a given tag. */
progressRouter.get("/practice", async (req, res) => {
  const content = await getContent();
  const progress = await loadProgress();
  const index = buildExerciseIndex(content);
  const requestedTag = typeof req.query.tag === "string" ? req.query.tag : null;
  const tag = requestedTag?.startsWith("writing:") ? practiceTagFor(requestedTag) : requestedTag;
  const generatedUnit = typeof req.query.generated === "string" ? req.query.generated : null;
  const unitId = typeof req.query.unit === "string" ? req.query.unit : null;
  const limit = Math.min(Number(req.query.limit ?? 12), 30);

  let ids: string[];
  if (generatedUnit) {
    const items = (content.generated.get(generatedUnit) ?? []).filter((i) => !i.hidden);
    ids = items
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((i) => i.exercise.id);
  } else if (tag) {
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
  // A backup is made first, so a reset can be undone by copying files back.
  await backupUserFiles(userDir, `reset-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  await saveProgress(defaultProgress());
  await saveSrs(defaultSrs());
  res.json({ ok: true });
});
