import { z } from "zod";
import type { FlagRecord } from "../schemas/store.js";
import { invalid, newId, nowIso, type Env } from "./context.js";
import { findExercise } from "./lookup.js";

const FlagInput = z.object({ itemId: z.string().trim().min(1).max(200), note: z.string().trim().max(500).default("") });

/** "Meld een fout": a note about a lesson or question. Notes travel in the progress file, so they can be collected. */
export async function addFlag(env: Env, body: unknown): Promise<FlagRecord> {
  const parsed = FlagInput.safeParse(body);
  if (!parsed.success) throw invalid("Je melding kon niet worden bewaard.");
  const flag: FlagRecord = { id: `f-${newId(env)}`, itemId: parsed.data.itemId, note: parsed.data.note, at: nowIso(env) };
  await env.store.flags.put(flag);
  return flag;
}

/** Best-effort title for an item id: an exercise prompt or a lesson title. */
export async function describeItem(env: Env, itemId: string): Promise<string> {
  const ex = await findExercise(env, itemId);
  if (ex) return ex.prompt;
  for (const unit of env.content.units.values()) {
    const lesson = unit.steps.find((s) => s.type === "lesson" && s.id === itemId);
    if (lesson && lesson.type === "lesson") return `Les: ${lesson.title}`;
  }
  return itemId;
}

export async function listFlags(env: Env) {
  const flags = (await env.store.flags.all()).sort((a, b) => b.at.localeCompare(a.at));
  return Promise.all(flags.map(async (f) => ({ ...f, title: await describeItem(env, f.itemId) })));
}

export async function removeFlag(env: Env, id: string): Promise<{ ok: true }> {
  await env.store.flags.delete(id);
  return { ok: true };
}
