import type { ClaudeGateway } from "../claude/gateway.js";
import type { Content } from "../content/types.js";
import { dayString } from "../logic/srs.js";
import { KV, type MetaRecord } from "../schemas/store.js";
import type { DataStore } from "../store/types.js";

/** What every service needs. Injected, so tests can use a memory store, fixed time and a fake Claude. */
export interface Env {
  store: DataStore;
  content: Content;
  now?: () => Date;
  newId?: () => string;
  random?: () => number;
  /** Returns the Claude gateway; throws NoApiKeyError when there is no key. */
  gateway?: () => ClaudeGateway;
}

/** An expected failure with a Dutch message. The router turns it into `{ error: { code, message } }`. */
export class ServiceError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const invalid = (message: string) => new ServiceError(400, "invalid_body", message);
export const notFound = (message: string) => new ServiceError(404, "not_found", message);

export const now = (env: Env) => env.now?.() ?? new Date();
export const nowIso = (env: Env) => now(env).toISOString();
export const today = (env: Env) => dayString(now(env));
export const newId = (env: Env) => env.newId?.() ?? crypto.randomUUID();
export const random = (env: Env) => env.random?.() ?? Math.random();

/** The id of this device (made once). It is written on every attempt, to tell devices apart after a merge. */
export async function deviceId(env: Env): Promise<string> {
  const meta = await env.store.kv.get<MetaRecord>(KV.meta);
  if (meta?.deviceId) return meta.deviceId;
  const created: MetaRecord = { ...meta, deviceId: newId(env) };
  await env.store.kv.set(KV.meta, created);
  return created.deviceId;
}
