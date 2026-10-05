import { ZodError } from "zod";
import { courseTree, getUnit, samenvatting } from "./course.js";
import { ServiceError, invalid, type Env } from "./context.js";
import { dashboard, practice } from "./dashboard.js";
import { examMistakes, getExam, getExamResult, listExams, saveExamState, startExam, submitExam } from "./exams.js";
import { applyImport, buildProgressFile, getDevice, lastImport, markExported, previewImport, sessionSummary, setDeviceName, undoLastImport } from "./transfer.js";
import { completeUnit, getProgress, recordAttempt, resetProgress, setUnitStep } from "./progress.js";
import { getSettings, updateSettings } from "./settings.js";
import { dueCards, introduce, reviewSrsCard, verbList, vocabList } from "./srs.js";
import { listWriting, saveWriting } from "./writing.js";
import { getWelcome, markWelcomeSeen } from "./welcome.js";
import { explain, feedbackWriting, flagGenerated, generate } from "./claude.js";

export type Method = "GET" | "POST" | "PUT";

export interface ApiResponse {
  status: number;
  body: unknown;
}

/** Things that live outside the data store (the API key). Filled in by the app. */
export interface RouterOptions {
  maskedKey?: () => Promise<string | null>;
  /** Stores the key (encrypted). Throws an Error with message "invalid_key" for something that is not a key. */
  saveKey?: (apiKey: string) => Promise<string>;
  removeKey?: () => Promise<void>;
  testKey?: () => Promise<{ ok: boolean; message: string }>;
}

interface Ctx {
  env: Env;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
  options: RouterOptions;
}

type Handler = (ctx: Ctx) => unknown | Promise<unknown>;

const num = (v: string | undefined) => (v === undefined || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v));

async function settingsView(ctx: Ctx) {
  return { ...(await getSettings(ctx.env)), apiKey: (await ctx.options.maskedKey?.()) ?? null };
}

/** The same paths the screens used with the Express server, now answered in the browser. */
const routes: [Method, string, Handler][] = [
  ["GET", "/course", (c) => courseTree(c.env)],
  ["GET", "/units/:id", (c) => getUnit(c.env, c.params.id)],
  ["GET", "/samenvatting", (c) => samenvatting(c.env)],
  ["GET", "/progress", (c) => getProgress(c.env)],
  ["GET", "/dashboard", (c) => dashboard(c.env)],
  ["GET", "/practice", (c) => practice(c.env, { tag: c.query.tag, unit: c.query.unit, generated: c.query.generated, limit: num(c.query.limit) })],
  ["POST", "/attempts", (c) => recordAttempt(c.env, c.body)],
  ["POST", "/units/:id/step", (c) => setUnitStep(c.env, c.params.id, c.body)],
  ["POST", "/units/:id/complete", (c) => completeUnit(c.env, c.params.id, c.body)],
  ["POST", "/progress/reset", (c) => resetProgress(c.env, c.body)],
  ["GET", "/srs/due", (c) => dueCards(c.env, { kind: c.query.kind, limit: num(c.query.limit) })],
  ["POST", "/srs/review", (c) => reviewSrsCard(c.env, c.body)],
  ["POST", "/srs/introduce", (c) => introduce(c.env, c.body)],
  ["GET", "/vocab", (c) => vocabList(c.env)],
  ["GET", "/verbs", (c) => verbList(c.env)],
  ["GET", "/exams", (c) => listExams(c.env)],
  ["GET", "/exams/results/:rid", (c) => getExamResult(c.env, c.params.rid)],
  ["GET", "/exams/results/:rid/mistakes", (c) => examMistakes(c.env, c.params.rid)],
  ["PUT", "/exams/results/:rid/state", (c) => saveExamState(c.env, c.params.rid, c.body)],
  ["POST", "/exams/results/:rid/submit", (c) => submitExam(c.env, c.params.rid, c.body)],
  ["GET", "/exams/:id", (c) => getExam(c.env, c.params.id)],
  ["POST", "/exams/:id/start", (c) => startExam(c.env, c.params.id)],
  ["GET", "/writing", (c) => listWriting(c.env)],
  ["POST", "/writing", (c) => saveWriting(c.env, c.body)],
  ["POST", "/claude/feedback-writing", (c) => feedbackWriting(c.env, c.body)],
  ["POST", "/claude/explain", (c) => explain(c.env, c.body)],
  ["POST", "/claude/generate", (c) => generate(c.env, c.body)],
  ["POST", "/generated/:id/flag", (c) => flagGenerated(c.env, c.params.id)],
  ["GET", "/settings", settingsView],
  [
    "PUT",
    "/settings",
    async (c) => {
      await updateSettings(c.env, c.body);
      return settingsView(c);
    },
  ],
  [
    "POST",
    "/settings/api-key",
    async (c) => {
      const apiKey = (c.body as { apiKey?: unknown } | undefined)?.apiKey;
      if (typeof apiKey !== "string" || !c.options.saveKey) throw invalid("Plak hier je API-sleutel.");
      try {
        await c.options.saveKey(apiKey);
      } catch {
        throw invalid("Dit lijkt geen Anthropic-sleutel. Die begint met sk-ant-.");
      }
      return settingsView(c);
    },
  ],
  [
    "POST",
    "/settings/api-key/remove",
    async (c) => {
      await c.options.removeKey?.();
      return settingsView(c);
    },
  ],
  ["POST", "/settings/test-key", async (c) => (await c.options.testKey?.()) ?? { ok: false, message: "Voeg eerst een API-sleutel toe." }],
  ["GET", "/export", (c) => buildProgressFile(c.env)],
  ["POST", "/import/preview", (c) => previewImport(c.env, c.body)],
  ["POST", "/import/apply", (c) => applyImport(c.env, c.body)],
  ["POST", "/import/undo", (c) => undoLastImport(c.env)],
  ["GET", "/import/last", async (c) => (await lastImport(c.env)) ?? null],
  ["GET", "/session/summary", (c) => sessionSummary(c.env)],
  ["POST", "/session/exported", (c) => markExported(c.env)],
  ["GET", "/welcome", (c) => getWelcome(c.env)],
  ["POST", "/welcome/seen", (c) => markWelcomeSeen(c.env)],
  ["GET", "/device", (c) => getDevice(c.env)],
  ["PUT", "/device", (c) => setDeviceName(c.env, c.body)],
];

const compiled = routes.map(([method, pattern, handler]) => {
  const names: string[] = [];
  const regex = new RegExp("^" + pattern.replace(/:([a-z]+)/gi, (_, n: string) => (names.push(n), "([^/]+)")) + "$");
  return { method, regex, names, handler };
});

function match(method: string, path: string) {
  for (const r of compiled) {
    if (r.method !== method) continue;
    const m = path.match(r.regex);
    if (m) return { route: r, params: Object.fromEntries(r.names.map((n, i) => [n, decodeURIComponent(m[i + 1])])) };
  }
  return null;
}

function split(url: string): { path: string; query: Record<string, string> } {
  const [path, qs = ""] = url.split("?");
  return { path, query: Object.fromEntries(new URLSearchParams(qs)) };
}

/**
 * An HTTP-like router in front of the services: `handle("POST", "/attempts", body)` → `{ status, body }`.
 * Errors come out in the same `{ error: { code, message } }` format the screens already understand.
 */
export function createApiRouter(getEnv: () => Promise<Env>, options: RouterOptions = {}) {
  return {
    /** Is there a route for this call? (Used by a test that checks every API call in the screens.) */
    has(method: Method, url: string) {
      return match(method, split(url).path) !== null;
    },

    async handle(method: Method, url: string, body?: unknown): Promise<ApiResponse> {
      const { path, query } = split(url);
      const found = match(method, path);
      if (!found) return { status: 404, body: { error: { code: "not_found", message: "Deze pagina bestaat niet." } } };
      try {
        const env = await getEnv();
        // A JSON round trip, like a real HTTP request: only plain data goes in (no Vue proxies, no undefined).
        const plain = body === undefined ? undefined : JSON.parse(JSON.stringify(body));
        const data = await found.route.handler({ env, params: found.params, query, body: plain, options });
        return { status: 200, body: data };
      } catch (err) {
        if (err instanceof ServiceError) return { status: err.status, body: { error: { code: err.code, message: err.message }, ...err.extra } };
        if (err instanceof ZodError) return { status: 400, body: { error: { code: "invalid_body", message: "De gegevens kloppen niet." } } };
        console.error("[api]", method, url, err);
        return { status: 500, body: { error: { code: "internal", message: "Er ging iets mis. Probeer het opnieuw." } } };
      }
    },
  };
}

export type ApiRouter = ReturnType<typeof createApiRouter>;
