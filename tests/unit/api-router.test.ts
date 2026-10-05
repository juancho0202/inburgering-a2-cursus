import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { createApiRouter, type Method } from "../../shared/services/router";
import { makeEnv } from "../helpers/fixtures";

const setup = (options = {}) => {
  const { env, clock } = makeEnv();
  return { env, clock, api: createApiRouter(async () => env, options) };
};

describe("in-browser API router", () => {
  it("answers the same paths as the old server, with data from the services", async () => {
    const { api } = setup();
    const course = await api.handle("GET", "/course");
    expect(course.status).toBe(200);
    expect((course.body as any).modules.map((m: any) => m.id)).toEqual(["basis", "knm", "schrijven"]);
    expect((await api.handle("GET", "/units/basis-a")).body).toMatchObject({ id: "basis-a" });
    expect((await api.handle("GET", "/samenvatting")).body).toEqual({ md: "# Samenvatting" });
  });

  it("saves an answer and shows it in the progress", async () => {
    const { api } = setup();
    expect(await api.handle("POST", "/attempts", { itemId: "basis-a-q-001", exerciseType: "mc", correct: true, answer: 0, durationMs: 5000 })).toEqual({ status: 200, body: { ok: true } });
    expect(((await api.handle("GET", "/progress")).body as any).items["basis-a-q-001"].seen).toBe(1);
  });

  it("reads query parameters and path parameters", async () => {
    const { api } = setup();
    await api.handle("POST", "/srs/introduce", { theme: "wonen" });
    expect(((await api.handle("GET", "/srs/due?kind=verb&limit=1")).body as any[]).length).toBeLessThanOrEqual(1);
    expect(((await api.handle("GET", "/srs/due?limit=2")).body as any[]).length).toBe(2);
    expect((await api.handle("POST", "/units/basis-a/step", { stepIndex: 2 })).status).toBe(200);
    expect(((await api.handle("GET", "/practice?tag=basis:a&limit=2")).body as any[]).length).toBe(2);
  });

  it("returns errors in the { error: { code, message } } format, with extra fields", async () => {
    const { api } = setup();
    expect(await api.handle("POST", "/attempts", { nope: 1 })).toEqual({ status: 400, body: { error: { code: "invalid_body", message: "Dit antwoord kon niet worden opgeslagen." } } });
    expect((await api.handle("GET", "/units/bestaat-niet")).status).toBe(404);
    const noKey = await api.handle("POST", "/claude/feedback-writing", { exerciseId: "schrijven-kort-q-001", text: "Hoi" });
    expect(noKey.status).toBe(503);
    expect(noKey.body).toMatchObject({ error: { code: "no_api_key" }, submissionId: expect.any(String) });
  });

  it("404s for unknown routes and wrong methods, and turns unexpected errors into a Dutch 500", async () => {
    const { api } = setup();
    expect((await api.handle("GET", "/bestaat-niet")).status).toBe(404);
    expect((await api.handle("POST", "/course")).status).toBe(404);
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const broken = createApiRouter(async () => {
      throw new Error("db kapot");
    });
    expect(await broken.handle("GET", "/course")).toEqual({ status: 500, body: { error: { code: "internal", message: "Er ging iets mis. Probeer het opnieuw." } } });
    spy.mockRestore();
  });

  it("only passes plain data to the services (like a real HTTP request)", async () => {
    const { api, env } = setup();
    const answer = new Proxy({ a: [1, 2], skip: undefined }, {});
    await api.handle("POST", "/attempts", { itemId: "q", exerciseType: "mc", correct: true, answer, durationMs: 1 });
    const stored = (await env.store.attempts.all())[0];
    expect(stored.answer).toEqual({ a: [1, 2] });
  });

  it("shows the settings with a masked key from the options, and a default test-key answer", async () => {
    const plain = setup();
    expect((await plain.api.handle("GET", "/settings")).body).toMatchObject({ apiKey: null, model: "claude-sonnet-5-5" });
    expect((await plain.api.handle("POST", "/settings/test-key")).body).toEqual({ ok: false, message: "Voeg eerst een API-sleutel toe." });

    const withKey = setup({ maskedKey: async () => "sk-ant-…abcd", testKey: async () => ({ ok: true, message: "Sleutel werkt." }) });
    expect((await withKey.api.handle("PUT", "/settings", { theme: "dark" })).body).toMatchObject({ apiKey: "sk-ant-…abcd", theme: "dark" });
    expect((await withKey.api.handle("POST", "/settings/test-key")).body).toEqual({ ok: true, message: "Sleutel werkt." });
  });

  it("exports everything without a key", async () => {
    const { api } = setup({ maskedKey: async () => "sk-ant-…abcd" });
    await api.handle("POST", "/attempts", { itemId: "q", exerciseType: "mc", correct: true, durationMs: 1 });
    const file = (await api.handle("GET", "/export")).body as any;
    expect(file).toMatchObject({ format: "inburgering-a2-progress", version: 2, contentVersion: "test0001" });
    expect(file.data.attempts).toHaveLength(1);
    expect(JSON.stringify(file)).not.toContain("sk-ant");
  });
});

describe("every API call in the screens has a route", () => {
  function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const full = path.join(dir, e.name);
      return e.isDirectory() ? sourceFiles(full) : /\.(vue|ts)$/.test(e.name) ? [full] : [];
    });
  }
  const calls: { file: string; method: Method; url: string }[] = [];
  for (const file of sourceFiles(path.resolve("src"))) {
    const text = fs.readFileSync(file, "utf-8");
    for (const m of text.matchAll(/api\.(get|post|put)(?:<[^>]*>)?\(\s*([`"'])([\s\S]*?)\2/g)) {
      calls.push({ file: path.relative(process.cwd(), file), method: m[1].toUpperCase() as Method, url: m[3].replace(/\$\{[^}]*\}/g, "x") });
    }
  }

  it("finds the calls (so this test cannot silently check nothing)", () => {
    expect(calls.length).toBeGreaterThan(25);
  });

  it.each(calls.map((c) => [`${c.method} ${c.url}`, c] as const))("%s", (_name, c) => {
    expect(setup().api.has(c.method, c.url), `${c.file} calls ${c.method} ${c.url}`).toBe(true);
  });
});

describe("api key routes", () => {
  it("saves a key through the options, never returns it in full, and removes it", async () => {
    let stored: string | null = null;
    const { api } = setup({
      maskedKey: async () => (stored ? "sk-ant-…abcd" : null),
      saveKey: async (k: string) => {
        if (!k.startsWith("sk-ant-")) throw new Error("invalid_key");
        stored = k;
        return "sk-ant-…abcd";
      },
      removeKey: async () => void (stored = null),
    });
    const saved = await api.handle("POST", "/settings/api-key", { apiKey: "sk-ant-api03-heelgeheim" });
    expect(saved.status).toBe(200);
    expect(saved.body).toMatchObject({ apiKey: "sk-ant-…abcd" });
    expect(JSON.stringify(saved.body)).not.toContain("heelgeheim");
    expect(JSON.stringify((await api.handle("GET", "/settings")).body)).not.toContain("heelgeheim");

    expect(await api.handle("POST", "/settings/api-key", { apiKey: "hallo" })).toMatchObject({ status: 400, body: { error: { message: "Dit lijkt geen Anthropic-sleutel. Die begint met sk-ant-." } } });
    expect((await api.handle("POST", "/settings/api-key", {})).status).toBe(400);

    expect((await api.handle("POST", "/settings/api-key/remove")).body).toMatchObject({ apiKey: null });
  });
});
