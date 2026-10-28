import { z } from "zod";
import { KV, defaultSettingsRecord, type SettingsRecord, type UsageRecord } from "../schemas/store.js";
import { EXAM_SKILLS, isDay, type ExamDates } from "../logic/studyPlan.js";
import { invalid, nowIso, type Env } from "./context.js";

/** The API key is handled elsewhere (encrypted, per device). The router adds `apiKey` (masked) to this. */
export interface SettingsView extends SettingsRecord {
  usage: UsageRecord;
}

const emptyUsage = (month: string): UsageRecord => ({ month, requests: 0, inputTokens: 0, outputTokens: 0 });
const monthOf = (env: Env) => nowIso(env).slice(0, 7);

export async function getSettings(env: Env): Promise<SettingsView> {
  const stored = await env.store.kv.get<Partial<SettingsRecord>>(KV.settings);
  const usage = await env.store.kv.get<UsageRecord>(KV.usage);
  return { ...defaultSettingsRecord(), ...stored, usage: usage && usage.month === monthOf(env) ? usage : emptyUsage(monthOf(env)) };
}

const UpdateSchema = z
  .object({
    model: z.string(),
    dailyGoalMinutes: z.number().int().min(1).max(600),
    newCardsPerDay: z.number().int().min(1).max(200),
    speechRate: z.number().min(0.3).max(2),
    spellcheckWriting: z.boolean(),
    theme: z.enum(["light", "dark", "system"]),
    soundEffects: z.boolean(),
    voiceAnnouncements: z.boolean(),
    lessonMusic: z.boolean(),
    /** Only the skills named change; `null` removes that date. */
    examDates: z.partialRecord(z.enum(EXAM_SKILLS), z.string().refine(isDay).nullable()),
  })
  .partial();

// Each change reads, merges and writes the whole record. Two quick changes (two exam dates, a theme and a sound)
// would overwrite each other, so they wait for each other per store.
const pending = new WeakMap<object, Promise<unknown>>();
function oneAtATime<T>(env: Env, job: () => Promise<T>): Promise<T> {
  const next = (pending.get(env.store) ?? Promise.resolve()).then(job);
  pending.set(env.store, next.catch(() => undefined));
  return next;
}

/** Read, change and write the settings record, one change at a time. */
export function changeSettings(env: Env, change: (current: SettingsRecord) => SettingsRecord): Promise<SettingsView> {
  return oneAtATime(env, async () => {
    const { usage: _usage, ...current } = await getSettings(env);
    await env.store.kv.set(KV.settings, { ...change(current), updatedAt: nowIso(env) });
    return getSettings(env);
  });
}

export async function updateSettings(env: Env, patch: unknown): Promise<SettingsView> {
  const parsed = UpdateSchema.safeParse(patch);
  if (!parsed.success) throw invalid("De instellingen zijn niet geldig.");
  const { examDates: datePatch, ...rest } = parsed.data;
  return changeSettings(env, (current) => {
    const examDates: ExamDates = { ...current.examDates };
    for (const [skill, date] of Object.entries(datePatch ?? {}) as [keyof ExamDates, string | null][]) {
      if (date) examDates[skill] = date;
      else delete examDates[skill];
    }
    return { ...current, ...rest, examDates };
  });
}

/** Count one Claude request in the monthly usage shown in Settings. */
export async function recordUsage(env: Env, usage: { inputTokens: number; outputTokens: number }): Promise<void> {
  const current = (await getSettings(env)).usage;
  await env.store.kv.set(KV.usage, {
    month: current.month,
    requests: current.requests + 1,
    inputTokens: current.inputTokens + usage.inputTokens,
    outputTokens: current.outputTokens + usage.outputTokens,
  } satisfies UsageRecord);
}
