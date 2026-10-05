import { z } from "zod";
import { KV, defaultSettingsRecord, type SettingsRecord, type UsageRecord } from "../schemas/store.js";
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
  })
  .partial();

export async function updateSettings(env: Env, patch: unknown): Promise<SettingsView> {
  const parsed = UpdateSchema.safeParse(patch);
  if (!parsed.success) throw invalid("De instellingen zijn niet geldig.");
  const { usage: _usage, ...current } = await getSettings(env);
  await env.store.kv.set(KV.settings, { ...current, ...parsed.data, updatedAt: nowIso(env) });
  return getSettings(env);
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
