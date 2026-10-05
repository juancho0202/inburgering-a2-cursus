import { KV } from "../schemas/store.js";
import { nowIso, type Env } from "./context.js";

/** Has this device shown the welcome screen? (A device setting: it is not part of the progress file.) */
export async function getWelcome(env: Env): Promise<{ seen: boolean }> {
  return { seen: !!(await env.store.kv.get(KV.welcomeSeen)) };
}

export async function markWelcomeSeen(env: Env): Promise<{ seen: true }> {
  await env.store.kv.set(KV.welcomeSeen, nowIso(env));
  return { seen: true };
}
