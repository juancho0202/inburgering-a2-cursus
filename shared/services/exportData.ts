import { KV, type MetaRecord } from "../schemas/store.js";
import { deviceId, nowIso, type Env } from "./context.js";
import { getSettings } from "./settings.js";

/**
 * Everything the learner saved, as one JSON-friendly object (the "progress file").
 * The API key is NOT part of the store, so it can never end up here.
 * Step 5 adds merge-import for this format.
 */
export async function exportData(env: Env) {
  const [attempts, units, srsCards, writing, examResults, explanations, generated, flags, settings, lastLocation, meta] = await Promise.all([
    env.store.attempts.all(),
    env.store.units.all(),
    env.store.srsCards.all(),
    env.store.writing.all(),
    env.store.examResults.all(),
    env.store.explanations.all(),
    env.store.generated.all(),
    env.store.flags.all(),
    getSettings(env),
    env.store.kv.get(KV.lastLocation),
    env.store.kv.get<MetaRecord>(KV.meta),
  ]);
  const { usage: _usage, ...settingsWithoutUsage } = settings;
  return {
    format: "inburgering-a2-progress",
    version: 2,
    exportedAt: nowIso(env),
    device: { id: await deviceId(env), name: meta?.deviceName ?? null },
    contentVersion: env.content.version,
    data: { attempts, units, srsCards, writing, examResults, explanations, generated, flags, settings: settingsWithoutUsage, lastLocation: lastLocation ?? null },
  };
}
