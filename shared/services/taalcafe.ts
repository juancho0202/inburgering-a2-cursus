import { z } from "zod";
import { KV, type TaalcafeLevels } from "../schemas/store.js";
import { taalcafeTopic } from "../logic/taalcafe.js";
import { topicLevels } from "../logic/taalcafeWords.js";
import { invalid, notFound, nowIso, type Env } from "./context.js";

/** Word levels won per taalcafé topic. */
export async function getTaalcafeLevels(env: Env): Promise<{ levels: Record<string, number> }> {
  const stored = await env.store.kv.get<TaalcafeLevels>(KV.taalcafeLevels);
  return { levels: stored?.levels ?? {} };
}

const WonBody = z.object({ topicId: z.string().max(100), level: z.number().int().min(1) });

/** A level of a topic is won (1 = the first). Winning an earlier level again changes nothing. */
export async function winTaalcafeLevel(env: Env, body: unknown): Promise<{ levels: Record<string, number> }> {
  const parsed = WonBody.safeParse(body);
  if (!parsed.success) throw invalid("Dit niveau is niet geldig.");
  const { topicId, level } = parsed.data;
  if (!taalcafeTopic(topicId)) throw notFound("Dit onderwerp bestaat niet.");
  if (level > topicLevels(topicId).length) throw invalid("Dit niveau is niet geldig.");
  const { levels } = await getTaalcafeLevels(env);
  if ((levels[topicId] ?? 0) >= level) return { levels };
  const next = { ...levels, [topicId]: level };
  await env.store.kv.set(KV.taalcafeLevels, { levels: next, updatedAt: nowIso(env) } satisfies TaalcafeLevels);
  return { levels: next };
}
