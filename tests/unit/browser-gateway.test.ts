import { describe, expect, it } from "vitest";
import { createBrowserGateway, testApiKey } from "../../shared/claude/browserGateway";
import { NoApiKeyError } from "../../shared/claude/gateway";
import { mapClaudeError } from "../../shared/claude/errors";
import { feedbackWriting } from "../../shared/services/claude";
import { getSettings } from "../../shared/services/settings";
import { makeEnv } from "../helpers/fixtures";

const KEY = "sk-ant-api03-abcdefghijklmnopqrstuvwxyz0123456789-ABCD";

interface Seen {
  url: string;
  headers: Record<string, string>;
  body: any;
}

/** A fake network: records the requests and answers with the next queued response. */
function fakeNetwork(...responses: (() => Response)[]) {
  const seen: Seen[] = [];
  const fetchFn = (async (input: unknown, init?: RequestInit) => {
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((v, k) => (headers[k] = v));
    seen.push({ url: String(input), headers, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    const next = responses.length > 1 ? responses.shift()! : responses[0];
    return next();
  }) as typeof fetch;
  return { fetch: fetchFn, seen };
}

const message = (text: string) => () =>
  new Response(
    JSON.stringify({ id: "msg_1", type: "message", role: "assistant", model: "m", content: [{ type: "text", text }], stop_reason: "end_turn", stop_sequence: null, usage: { input_tokens: 11, output_tokens: 22 } }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
const failure = (status: number) => () => new Response(JSON.stringify({ type: "error", error: { type: "x", message: "nope" } }), { status, headers: { "content-type": "application/json" } });

const gateway = (net: ReturnType<typeof fakeNetwork>, key: string | null = KEY) =>
  createBrowserGateway({ getKey: async () => key, getModel: async () => "claude-sonnet-5-5", fetch: net.fetch, maxRetries: 0 });

describe("browser gateway (the learner's own key, straight to Anthropic)", () => {
  it("sends the key, the model and the structured-output schema to api.anthropic.com only", async () => {
    const net = fakeNetwork(message('{"ok":true}'));
    const res = await gateway(net).complete({ system: "Systeem", user: "Vraag", schema: { type: "object" }, maxTokens: 123 });
    expect(res).toEqual({ text: '{"ok":true}', usage: { inputTokens: 11, outputTokens: 22 } });

    expect(net.seen).toHaveLength(1);
    const req = net.seen[0];
    expect(req.url).toBe("https://api.anthropic.com/v1/messages");
    expect(req.headers["x-api-key"]).toBe(KEY);
    expect(req.headers["anthropic-dangerous-direct-browser-access"]).toBe("true");
    expect(req.body).toMatchObject({
      model: "claude-sonnet-5-5",
      max_tokens: 123,
      system: "Systeem",
      messages: [{ role: "user", content: "Vraag" }],
      output_config: { format: { type: "json_schema", schema: { type: "object" } } },
    });
    expect(JSON.stringify(req.body)).not.toContain(KEY); // the key goes in the header, never in the body
  });

  it("without a key it throws NoApiKeyError and makes no request", async () => {
    const net = fakeNetwork(message("{}"));
    await expect(gateway(net, null).complete({ system: "s", user: "u", schema: {}, maxTokens: 10 })).rejects.toBeInstanceOf(NoApiKeyError);
    expect(net.seen).toHaveLength(0);
  });

  it("turns failures into Dutch messages", async () => {
    const run = async (r: () => Response) => {
      const err = await gateway(fakeNetwork(r)).complete({ system: "s", user: "u", schema: {}, maxTokens: 10 }).catch((e) => e);
      return mapClaudeError(err);
    };
    expect(await run(failure(401))).toBe("De API-sleutel klopt niet.");
    expect(await run(failure(429))).toBe("Te veel verzoeken. Probeer het over een minuut opnieuw.");
    expect(await run(failure(500))).toBe("Claude is even niet bereikbaar. Je antwoord is wel opgeslagen.");
    expect(await run(failure(529))).toBe("Claude is even niet bereikbaar. Je antwoord is wel opgeslagen.");

    const offline = createBrowserGateway({ getKey: async () => KEY, getModel: async () => "m", maxRetries: 0, fetch: (async () => { throw new TypeError("Failed to fetch"); }) as typeof fetch });
    expect(mapClaudeError(await offline.complete({ system: "s", user: "u", schema: {}, maxTokens: 10 }).catch((e) => e))).toBe("Geen internet.");
  });

  it("tests a key with a tiny request", async () => {
    const good = fakeNetwork(message("hallo"));
    expect(await testApiKey(KEY, "claude-haiku-4-5-20251001", { fetch: good.fetch, maxRetries: 0 })).toEqual({ ok: true, message: "Sleutel werkt." });
    expect(good.seen[0].body).toMatchObject({ max_tokens: 20, model: "claude-haiku-4-5-20251001" });
    expect(good.seen[0].body.output_config).toBeUndefined();

    const bad = fakeNetwork(failure(401));
    expect(await testApiKey("sk-ant-fout-fout-fout-fout-fout", "m", { fetch: bad.fetch, maxRetries: 0 })).toEqual({ ok: false, message: "De API-sleutel klopt niet." });
  });

  it("works end to end through a service: writing feedback with the model from the settings", async () => {
    const feedback = { overall: "voldoende", score: 8, criteria: [], missingPoints: [], corrections: [], correctedText: "x", strongPoints: ["Netjes"], nextTip: "Oefen." };
    const net = fakeNetwork(message(JSON.stringify(feedback)));
    const { env } = makeEnv();
    env.gateway = () => createBrowserGateway({ getKey: async () => KEY, getModel: async () => (await getSettings(env)).model, fetch: net.fetch, maxRetries: 0 });

    const res = await feedbackWriting(env, { exerciseId: "schrijven-kort-q-001", text: "Hoi buurman, zaterdag geef ik een feestje." });
    expect(res.feedback.overall).toBe("voldoende");
    expect(net.seen[0].body.model).toBe("claude-sonnet-5-5");
    expect(net.seen[0].body.messages[0].content).toContain("Hoi buurman, zaterdag geef ik een feestje.");
    expect(net.seen[0].body.messages[0].content).not.toContain("Voorbeeld"); // the model answer is never sent
    expect((await getSettings(env)).usage).toMatchObject({ requests: 1, inputTokens: 11, outputTokens: 22 });
  });
});
