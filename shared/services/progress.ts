import { z } from "zod";
import { itemStats, minutesByDay, streakFrom } from "../logic/stats.js";
import {
  AttemptInputSchema,
  KV,
  type AttemptRecord,
  type LastLocation,
  type UnitRecord,
} from "../schemas/store.js";
import type { ItemProgress, Progress } from "../types.js";
import { deviceId, invalid, newId, nowIso, today, type Env } from "./context.js";
import { getSettings } from "./settings.js";
import { introduceCards } from "./srs.js";

/** One answer can count for at most 3 minutes of study time, so an idle tab does not inflate the minutes. */
export const MAX_ANSWER_MS = 180_000;

export async function recordAttempt(env: Env, body: unknown): Promise<{ ok: true }> {
  const parsed = AttemptInputSchema.safeParse(body);
  if (!parsed.success) throw invalid("Dit antwoord kon niet worden opgeslagen.");
  await addAttempt(env, { ...parsed.data, durationMs: Math.min(parsed.data.durationMs, MAX_ANSWER_MS) });
  return { ok: true };
}

/** Append one fact to the attempts log. Used by answers, exams and writing checks. */
export async function addAttempt(env: Env, a: Omit<AttemptRecord, "id" | "at" | "deviceId">): Promise<void> {
  await env.store.attempts.put({ ...a, id: newId(env), at: nowIso(env), deviceId: await deviceId(env) });
}

/** Everything derived from the attempts log. */
export async function derivedStats(env: Env) {
  const attempts = await env.store.attempts.all();
  return {
    items: itemStats(attempts),
    minutes: minutesByDay(attempts),
    streak: streakFrom(Object.keys(minutesByDay(attempts)), today(env)),
  };
}

export async function getLastLocation(env: Env): Promise<LastLocation | null> {
  return (await env.store.kv.get<LastLocation | null>(KV.lastLocation)) ?? null;
}

/** The whole-progress summary the UI uses (units and per-item results). */
export async function getProgress(env: Env): Promise<Progress> {
  const [stats, units, exams, settings, lastLocation, attempts] = await Promise.all([
    derivedStats(env),
    env.store.units.all(),
    env.store.examResults.all(),
    getSettings(env),
    getLastLocation(env),
    env.store.attempts.all(),
  ]);
  const sortedAt = attempts.map((a) => a.at).sort();
  return {
    version: 1,
    startedAt: sortedAt[0] ?? nowIso(env),
    lastActivityAt: sortedAt[sortedAt.length - 1] ?? nowIso(env),
    lastLocation: lastLocation ? { unitId: lastLocation.unitId, stepIndex: lastLocation.stepIndex } : null,
    streak: stats.streak,
    dailyGoalMinutes: settings.dailyGoalMinutes,
    minutesByDay: stats.minutes,
    units: Object.fromEntries(
      units.map((u) => [u.id, { status: u.status, bestScore: u.bestScore, attempts: u.attempts, stepIndex: u.stepIndex, completedAt: u.completedAt }]),
    ),
    items: stats.items as Record<string, ItemProgress>,
    exams: exams.map(({ updatedAt: _u, ...rest }) => rest),
  };
}

const StepSchema = z.object({ stepIndex: z.number().int().min(0) });

export async function setUnitStep(env: Env, unitId: string, body: unknown): Promise<{ ok: true }> {
  const parsed = StepSchema.safeParse(body);
  if (!parsed.success) throw invalid("De stap kon niet worden opgeslagen.");
  const existing = await env.store.units.get(unitId);
  const stamp = nowIso(env);
  await env.store.units.put({
    id: unitId,
    status: existing?.status ?? "in_progress",
    bestScore: existing?.bestScore ?? null,
    attempts: existing?.attempts ?? 0,
    stepIndex: parsed.data.stepIndex,
    completedAt: existing?.completedAt ?? null,
    updatedAt: stamp,
  });
  await env.store.kv.set(KV.lastLocation, { unitId, stepIndex: parsed.data.stepIndex, updatedAt: stamp } satisfies LastLocation);
  return { ok: true };
}

const CompleteSchema = z.object({ score: z.number().min(0).max(1) });

export async function completeUnit(env: Env, unitId: string, body: unknown): Promise<{ ok: true; wordsIntroduced: number }> {
  const parsed = CompleteSchema.safeParse(body);
  if (!parsed.success) throw invalid("De score kon niet worden opgeslagen.");
  const existing = await env.store.units.get(unitId);
  const stamp = nowIso(env);
  const record: UnitRecord = {
    id: unitId,
    status: "completed",
    bestScore: Math.max(existing?.bestScore ?? 0, parsed.data.score),
    attempts: (existing?.attempts ?? 0) + 1,
    stepIndex: 0,
    completedAt: stamp,
    updatedAt: stamp,
  };
  await env.store.units.put(record);
  await env.store.kv.delete(KV.lastLocation);
  const unit = env.content.units.get(unitId);
  return { ok: true, wordsIntroduced: unit ? await introduceCards(env, unit.vocabRefs) : 0 };
}

/** Wipes progress and word cards. Writing texts, Claude explanations and generated exercises stay. */
export async function resetProgress(env: Env, body: unknown): Promise<{ ok: true }> {
  if (!z.object({ confirm: z.literal("RESET") }).safeParse(body).success) throw invalid("Bevestig met RESET om door te gaan.");
  await Promise.all([env.store.attempts.clear(), env.store.units.clear(), env.store.srsCards.clear(), env.store.examResults.clear()]);
  await env.store.kv.delete(KV.lastLocation);
  await env.store.kv.delete(KV.srsNewToday);
  return { ok: true };
}
