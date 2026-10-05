import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseProgressFile } from "../../shared/services/transfer";

describe("npm run migrate-old-progress", () => {
  it("turns an old data/user folder into a progress file without the API key", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "old-"));
    fs.writeFileSync(path.join(dir, "progress.json"), JSON.stringify({ version: 1, startedAt: "2026-10-01T09:00:00Z", lastActivityAt: "2026-10-02T09:00:00Z", lastLocation: null, streak: {}, minutesByDay: {}, units: { "basis-tijd": { status: "completed", bestScore: 0.8, attempts: 1, stepIndex: 0, completedAt: "2026-10-02T09:00:00Z" } }, items: { "basis-tijd-q-001": { seen: 2, correct: 1, lastCorrect: true, lastSeenAt: "2026-10-02T08:00:00Z" } }, exams: [] }));
    fs.writeFileSync(path.join(dir, "attempts.jsonl"), `${JSON.stringify({ itemId: "basis-tijd-q-001", exerciseType: "mc", correct: false, durationMs: 5000, at: "2026-10-02T07:00:00Z" })}\nkapotte regel\n`);
    fs.writeFileSync(path.join(dir, "settings.json"), JSON.stringify({ apiKey: "sk-ant-api03-GEHEIM-GEHEIM-GEHEIM-1234", model: "claude-haiku-4-5-20251001" }));
    const out = path.join(dir, "uit.json");
    execFileSync("npx", ["tsx", "scripts/migrate-old-progress.ts", dir, out], { stdio: "pipe" });

    const text = fs.readFileSync(out, "utf-8");
    expect(text).not.toContain("GEHEIM");
    const { file } = parseProgressFile(JSON.parse(text));
    expect(file.data.units[0]).toMatchObject({ id: "basis-tijd", status: "completed", bestScore: 0.8 });
    expect(file.data.attempts).toHaveLength(2); // one logged + one synthetic (seen 2, logged 1)
    expect(file.data.settings?.model).toBe("claude-haiku-4-5-20251001");
  }, 30_000);
});
