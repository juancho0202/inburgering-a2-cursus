import { describe, expect, it } from "vitest";
import { itemStats } from "../../shared/logic/stats";
import { planMerge } from "../../shared/logic/merge";
import { emptyProgressData } from "../../shared/schemas/transfer";
import { createApiRouter } from "../../shared/services/router";
import { completeUnit, getProgress, recordAttempt, setUnitStep } from "../../shared/services/progress";
import { introduce, reviewSrsCard } from "../../shared/services/srs";
import { getSettings, updateSettings } from "../../shared/services/settings";
import { dashboard } from "../../shared/services/dashboard";
import { startExam, submitExam } from "../../shared/services/exams";
import {
  applyImport,
  backupReminder,
  buildProgressFile,
  convertLegacyExport,
  getDevice,
  lastImport,
  markExported,
  parseProgressFile,
  previewImport,
  sessionSummary,
  setDeviceName,
  undoLastImport,
} from "../../shared/services/transfer";
import { makeClock, makeEnv } from "../helpers/fixtures";

const ans = (itemId: string, correct: boolean, durationMs = 10_000) => ({ itemId, exerciseType: "mc", correct, answer: 0, durationMs });

/** Two devices (laptop and phone) that share one clock but have separate stores. */
function twoDevices() {
  const clock = makeClock();
  const laptop = makeEnv({ clock }).env;
  const phone = makeEnv({ clock }).env;
  // makeEnv numbers its ids id-1, id-2, ...; give each device its own prefix, like real UUIDs
  let a = 0;
  let b = 0;
  laptop.newId = () => `laptop-${++a}`;
  phone.newId = () => `phone-${++b}`;
  return { laptop, phone, clock };
}

const syncTo = async (from: Parameters<typeof buildProgressFile>[0], to: Parameters<typeof buildProgressFile>[0]) => applyImport(to, { file: await buildProgressFile(from) });
const stats = async (env: Parameters<typeof buildProgressFile>[0]) => itemStats(await env.store.attempts.all());

describe("progress file", () => {
  it("round-trips through parse and contains the data, the device and the course version", async () => {
    const { env } = makeEnv();
    await recordAttempt(env, ans("basis-a-q-001", true));
    await setDeviceName(env, { name: "Laptop" });
    const file = await buildProgressFile(env);
    expect(file).toMatchObject({ format: "inburgering-a2-progress", version: 2, contentVersion: "test0001", device: { name: "Laptop" } });
    const parsed = parseProgressFile(JSON.parse(JSON.stringify(file)));
    expect(parsed.legacy).toBe(false);
    expect(parsed.file.data.attempts).toHaveLength(1);
  });

  it("refuses files that are not progress files, in Dutch", () => {
    for (const bad of [null, "tekst", 42, {}, { format: "iets-anders" }]) {
      expect(() => parseProgressFile(bad)).toThrowError("Dit is geen voortgangsbestand van deze app.");
    }
    expect(() => parseProgressFile({ format: "inburgering-a2-progress", version: 3 })).toThrowError(/nieuwere versie/);
    expect(() => parseProgressFile({ format: "inburgering-a2-progress", version: 2, exportedAt: "x", device: { id: "d", name: null }, contentVersion: "v", data: { attempts: "kapot" } })).toThrowError(/beschadigd/);
  });
});

describe("handing over between two devices", () => {
  it("combines both devices' answers without double counting, in either direction, and is idempotent", async () => {
    const { laptop, phone, clock } = twoDevices();
    await recordAttempt(laptop, ans("basis-a-q-001", true));
    clock.advanceMs(60_000);
    await recordAttempt(laptop, ans("basis-a-q-002", false));
    clock.advanceMs(60_000);
    await syncTo(laptop, phone); // laptop → phone

    await recordAttempt(phone, ans("basis-a-q-001", false)); // on the phone: same question again, wrong this time
    clock.advanceMs(60_000);
    await recordAttempt(phone, ans("basis-a-q-003", true));
    await syncTo(phone, laptop); // phone → laptop

    expect((await laptop.store.attempts.all()).length).toBe(4);
    expect(await stats(laptop)).toEqual(await stats(phone));
    expect((await stats(laptop))["basis-a-q-001"]).toMatchObject({ seen: 2, correct: 1, lastCorrect: false });

    // importing again (either way) changes nothing
    expect((await syncTo(laptop, phone)).nothingNew).toBe(true);
    expect((await syncTo(phone, laptop)).nothingNew).toBe(true);
    expect((await laptop.store.attempts.all()).length).toBe(4);
  });

  it("an older file never undoes newer work", async () => {
    const { laptop, phone, clock } = twoDevices();
    await setUnitStep(phone, "basis-a", { stepIndex: 1 }); // phone: just started, long ago
    const oldFile = await buildProgressFile(phone);
    clock.advanceDays(1);
    await completeUnit(laptop, "basis-a", { score: 0.9 });
    await recordAttempt(laptop, ans("basis-a-q-001", true));

    const preview = await applyImport(laptop, { file: oldFile });
    expect(preview.counts.units).toMatchObject({ new: 0, updated: 0 });
    expect((await getProgress(laptop)).units["basis-a"]).toMatchObject({ status: "completed", bestScore: 0.9 });
  });

  it("merges a unit: completed wins, best score is the maximum, the newest step is kept", async () => {
    const mk = (over: object) => ({ ...emptyProgressData(), units: [{ id: "u", status: "in_progress" as const, bestScore: null, attempts: 0, stepIndex: 0, completedAt: null, updatedAt: "2026-10-01T10:00:00Z", ...over }] });
    const plan = planMerge(
      mk({ status: "completed", bestScore: 0.6, attempts: 1, completedAt: "2026-10-01T10:00:00Z", updatedAt: "2026-10-01T10:00:00Z" }),
      mk({ status: "in_progress", bestScore: 0.8, attempts: 2, stepIndex: 5, updatedAt: "2026-10-02T10:00:00Z" }),
    );
    expect(plan.writes.units[0]).toMatchObject({ status: "completed", bestScore: 0.8, attempts: 2, stepIndex: 5, completedAt: "2026-10-01T10:00:00Z", updatedAt: "2026-10-02T10:00:00Z" });
  });

  it("keeps the newer word card, whichever device it came from", async () => {
    const { laptop, phone, clock } = twoDevices();
    await introduce(laptop, { theme: "wonen" });
    await syncTo(laptop, phone);
    const card = (await laptop.store.srsCards.all())[0];

    clock.advanceMs(1000);
    await reviewSrsCard(laptop, { cardId: card.id, grade: "goed" }); // laptop reviews first
    clock.advanceMs(1000);
    await reviewSrsCard(phone, { cardId: card.id, grade: "makkelijk" }); // phone reviews later: box 2

    await syncTo(phone, laptop); // newer one wins on the laptop
    expect((await laptop.store.srsCards.get(card.id))?.box).toBe(2);
    await syncTo(laptop, phone); // and the older laptop file does not overwrite the phone
    expect((await phone.store.srsCards.get(card.id))?.box).toBe(2);
  });

  it("keeps Claude feedback on a text, finished exams, hidden generated items, newest settings and position", async () => {
    const { laptop, phone, clock } = twoDevices();
    // writing: the phone has feedback, the laptop only the text
    const sub = { id: "w-1", exerciseId: "schrijven-kort-q-001", text: "Hoi", submittedAt: "2026-10-05T10:00:00Z", feedback: null };
    await laptop.store.writing.put(sub);
    await phone.store.writing.put({ ...sub, feedback: { overall: "voldoende", score: 8 } });
    // exam: finished on the laptop, still open on the phone
    const { result } = await startExam(laptop, "exam-knm-t");
    await submitExam(laptop, result.id, { answers: { "exam-knm-t-q-001": [0] } });
    await phone.store.examResults.put({ ...(await laptop.store.examResults.get(result.id))!, finishedAt: null, score: 0, max: 0 });
    // generated: hidden on the phone only
    const gen = { id: "gen-1", unitId: "basis-a", exercise: { id: "gen-1", type: "mc", tags: [], prompt: "p", options: ["a", "b"], answer: 0, explanation: "e", difficulty: 1 }, hidden: false, createdAt: "t", updatedAt: "t" } as any;
    await laptop.store.generated.put(gen);
    await phone.store.generated.put({ ...gen, hidden: true });
    // settings and position: the phone is newer
    clock.advanceMs(1000);
    await updateSettings(laptop, { theme: "light" });
    clock.advanceMs(1000);
    await updateSettings(phone, { theme: "dark" });
    await setUnitStep(phone, "basis-a", { stepIndex: 2 });

    await syncTo(phone, laptop);
    expect((await laptop.store.writing.get("w-1"))?.feedback).toMatchObject({ overall: "voldoende" });
    expect((await laptop.store.examResults.get(result.id))?.finishedAt).toBeTruthy();
    expect((await laptop.store.generated.get("gen-1"))?.hidden).toBe(true);
    expect((await getSettings(laptop)).theme).toBe("dark");
    expect((await dashboard(laptop)).lastLocation).toMatchObject({ unitId: "basis-a", stepIndex: 2 });

    // the other direction: finished exam and feedback travel to the phone, the open exam does not overwrite them
    await syncTo(laptop, phone);
    expect((await phone.store.examResults.get(result.id))?.finishedAt).toBeTruthy();
  });

  it("on the same day a second device does not get a fresh allowance of new words", async () => {
    const plan = planMerge(
      { ...emptyProgressData(), srsNewToday: { day: "2026-10-05", count: 4 } },
      { ...emptyProgressData(), srsNewToday: { day: "2026-10-05", count: 15 } },
    );
    expect(plan.srsNewToday).toEqual({ day: "2026-10-05", count: 15 });
    expect(planMerge({ ...emptyProgressData(), srsNewToday: { day: "2026-10-05", count: 15 } }, { ...emptyProgressData(), srsNewToday: { day: "2026-10-05", count: 4 } }).srsNewToday).toBeUndefined();
  });
});

describe("preview, import and undo", () => {
  it("previews what would change without changing anything", async () => {
    const { laptop, phone } = twoDevices();
    await recordAttempt(laptop, ans("basis-a-q-001", true));
    await recordAttempt(laptop, ans("basis-a-q-002", true));
    await completeUnit(laptop, "basis-a", { score: 1 });
    await setDeviceName(laptop, { name: "Laptop" });
    const file = await buildProgressFile(laptop);

    const preview = await previewImport(phone, { file });
    expect(preview).toMatchObject({ from: { deviceName: "Laptop", legacy: false }, contentChanged: false, nothingNew: false });
    expect(preview.counts.attempts).toEqual({ new: 2, updated: 0, total: 2 });
    expect(preview.counts.units.new).toBe(1);
    expect(preview.counts.srsCards.new).toBe(5);
    expect(await phone.store.attempts.all()).toEqual([]); // nothing was written
  });

  it("warns when the course changed and counts items this version does not know", async () => {
    const { laptop, phone } = twoDevices();
    await recordAttempt(laptop, ans("basis-a-q-001", true));
    await recordAttempt(laptop, ans("bestaat-niet-q-001", true));
    const file = await buildProgressFile(laptop);
    file.contentVersion = "oud00001";
    const preview = await previewImport(phone, { file });
    expect(preview.contentChanged).toBe(true);
    expect(preview.unknownItems).toBe(1);
  });

  it("undoes the last import and restores everything exactly", async () => {
    const { laptop, phone } = twoDevices();
    await recordAttempt(phone, ans("basis-a-q-003", true));
    await updateSettings(phone, { theme: "light" });
    const before = JSON.stringify(await buildProgressFile(phone).then((f) => f.data));
    expect(await lastImport(phone)).toBeNull();

    await recordAttempt(laptop, ans("basis-a-q-001", false));
    await completeUnit(laptop, "basis-a", { score: 0.7 });
    await updateSettings(laptop, { theme: "dark" });
    await setDeviceName(laptop, { name: "Laptop" });
    await syncTo(laptop, phone);
    expect((await phone.store.attempts.all()).length).toBe(2);
    expect(await lastImport(phone)).toMatchObject({ from: "Laptop" });

    await undoLastImport(phone);
    expect(JSON.stringify((await buildProgressFile(phone)).data)).toBe(before);
    expect(await lastImport(phone)).toBeNull();
    await expect(undoLastImport(phone)).rejects.toMatchObject({ status: 404 });
  });

  it("works through the router (preview → apply → last → undo)", async () => {
    const { laptop, phone } = twoDevices();
    await recordAttempt(laptop, ans("basis-a-q-001", true));
    const file = await buildProgressFile(laptop);
    const api = createApiRouter(async () => phone);
    expect(((await api.handle("POST", "/import/preview", { file })).body as any).counts.attempts.new).toBe(1);
    expect((await api.handle("POST", "/import/apply", { file })).status).toBe(200);
    expect(((await api.handle("GET", "/import/last")).body as any).at).toBeTruthy();
    expect((await api.handle("POST", "/import/undo")).status).toBe(200);
    expect((await api.handle("GET", "/import/last")).body).toBeNull();
    expect((await api.handle("POST", "/import/preview", { file: { nee: 1 } })).body).toMatchObject({ error: { code: "invalid_file" } });
    expect((await api.handle("POST", "/import/preview", {})).status).toBe(400);
  });
});

describe("importing a file from the old (server) version", () => {
  const legacy = () => ({
    exportedAt: "2026-10-04T12:00:00.000Z",
    files: {
      "progress.json": {
        version: 1, startedAt: "2026-10-01T09:00:00Z", lastActivityAt: "2026-10-03T20:00:00Z",
        lastLocation: { unitId: "basis-a", stepIndex: 2 }, streak: { current: 3, best: 3, lastDay: "2026-10-03" }, dailyGoalMinutes: 30, minutesByDay: {},
        units: { "basis-a": { status: "in_progress", bestScore: null, attempts: 0, stepIndex: 2, completedAt: null } },
        items: {
          "basis-a-q-001": { seen: 5, correct: 3, lastCorrect: false, lastSeenAt: "2026-10-03T19:00:00Z" },
          "basis-a-q-002": { seen: 4, correct: 3, lastCorrect: true, lastSeenAt: "2026-10-02T19:00:00Z" },
          "exam-knm-t-q-001": { seen: 1, correct: 1, lastCorrect: true, lastSeenAt: "2026-10-03T21:00:00Z" },
        },
        exams: [{ examId: "exam-knm-t", startedAt: "2026-10-03T20:00:00Z", finishedAt: "2026-10-03T20:30:00Z", score: 2, max: 3, answers: {}, byTheme: { "knm:wonen": [1, 2] } }],
      },
      "srs.json": { version: 1, newToday: { day: "2026-10-03", count: 7 }, cards: { "v-huur:meaning": { id: "v-huur:meaning", refId: "v-huur", cardType: "meaning", box: 2, due: "2026-10-05", reps: 3, lapses: 0, lastReviewedAt: "2026-10-03T10:00:00Z" } } },
      "writing.json": { version: 1, submissions: [{ id: "w-1", exerciseId: "schrijven-kort-q-001", text: "Hoi buurman", submittedAt: "2026-10-03T11:00:00Z", feedback: { overall: "voldoende", score: 8 } }] },
      "explanations.json": { version: 1, entries: { "basis-a-q-001::fout": { explanation: "Uitleg", rule: null, extraExamples: ["Voorbeeld"] } } },
      "settings.json": { version: 1, apiKey: "sk-ant-api03-GEHEIM-GEHEIM-GEHEIM-1234", model: "claude-haiku-4-5-20251001", dailyGoalMinutes: 45, newCardsPerDay: 10, speechRate: 0.9, spellcheckWriting: true, theme: "dark", usage: { requests: 5, inputTokens: 1, outputTokens: 1 } },
      "attempts.jsonl": [
        { itemId: "basis-a-q-001", exerciseType: "mc", correct: true, answer: 0, durationMs: 8000, at: "2026-10-02T10:00:00Z" },
        { itemId: "basis-a-q-001", exerciseType: "mc", correct: false, answer: 1, durationMs: 9000, at: "2026-10-03T19:00:00Z" },
      ],
    },
  });

  it("keeps all numbers: stats per item, units, cards, texts, exams, settings and position", async () => {
    const converted = convertLegacyExport(legacy());
    const { env } = makeEnv();
    await applyImport(env, { file: converted });

    const items = (await getProgress(env)).items;
    expect(items["basis-a-q-001"]).toMatchObject({ seen: 5, correct: 3, lastCorrect: false });
    expect(items["basis-a-q-002"]).toMatchObject({ seen: 4, correct: 3, lastCorrect: true });
    expect(items["exam-knm-t-q-001"]).toMatchObject({ seen: 1, correct: 1, lastCorrect: true });

    const p = await getProgress(env);
    expect(p.units["basis-a"]).toMatchObject({ status: "in_progress", stepIndex: 2 });
    expect((await dashboard(env)).lastLocation).toMatchObject({ unitId: "basis-a", stepIndex: 2 });
    expect((await env.store.srsCards.get("v-huur:meaning"))?.box).toBe(2);
    expect((await env.store.writing.get("w-1"))?.feedback).toMatchObject({ overall: "voldoende" });
    expect(await env.store.explanations.get("basis-a-q-001::fout")).toMatchObject({ explanation: "Uitleg" });
    expect(await env.store.examResults.all()).toHaveLength(1);
    expect(await getSettings(env)).toMatchObject({ model: "claude-haiku-4-5-20251001", dailyGoalMinutes: 45, theme: "dark" });
    // study time from the log carries over (8 + 9 seconds)
    expect(Object.values(p.minutesByDay).reduce((a, b) => a + b, 0)).toBeCloseTo(17 / 60, 1);
  });

  it("never carries the API key over, and importing the old file twice adds nothing", async () => {
    const converted = convertLegacyExport(legacy());
    expect(JSON.stringify(converted)).not.toContain("GEHEIM");
    expect(JSON.stringify(converted)).not.toContain("apiKey");
    const { env } = makeEnv();
    await applyImport(env, { file: converted });
    const again = await applyImport(env, { file: convertLegacyExport(legacy()) });
    expect(again.nothingNew).toBe(true);
    expect(await previewImport(env, { file: legacy() })).toMatchObject({ from: { legacy: true, deviceName: "Oude versie" }, nothingNew: true });
  });

  it("is recognised by parseProgressFile and refuses a broken old file", () => {
    expect(parseProgressFile(legacy()).legacy).toBe(true);
    expect(() => parseProgressFile({ files: {} })).toThrowError("Dit is geen voortgangsbestand van deze app.");
  });
});

describe("Klaar voor vandaag and the backup reminder", () => {
  it("summarises today and tracks what is not saved yet", async () => {
    const { env, clock } = makeEnv();
    await recordAttempt(env, ans("basis-a-q-001", true, 60_000));
    await recordAttempt(env, ans("basis-a-q-002", false, 30_000));
    await completeUnit(env, "basis-a", { score: 1 });
    expect(await sessionSummary(env)).toMatchObject({ minutesToday: 1.5, answersToday: 2, correctToday: 1, unitsCompletedToday: 1, unsavedAnswers: 2, lastExportAt: null });

    clock.advanceMs(1000);
    await markExported(env);
    expect((await sessionSummary(env)).unsavedAnswers).toBe(0);
    clock.advanceMs(1000);
    await recordAttempt(env, ans("basis-a-q-003", true));
    expect((await sessionSummary(env)).unsavedAnswers).toBe(1);
  });

  it("reminds only when there is unsaved work and the last save is more than 2 days ago (or never)", async () => {
    const { env, clock } = makeEnv();
    expect((await backupReminder(env)).show).toBe(false); // nothing to save
    await recordAttempt(env, ans("basis-a-q-001", true));
    expect(await backupReminder(env)).toMatchObject({ show: true, daysAgo: null, unsavedAnswers: 1 });
    await markExported(env);
    expect((await backupReminder(env)).show).toBe(false);
    clock.advanceDays(1);
    await recordAttempt(env, ans("basis-a-q-002", true));
    expect((await backupReminder(env)).show).toBe(false); // saved 1 day ago
    clock.advanceDays(2);
    expect(await backupReminder(env)).toMatchObject({ show: true, daysAgo: 3 });
    expect((await dashboard(env)).backupReminder.show).toBe(true);
  });

  it("stores a device name (shown in the file) and validates it", async () => {
    const { env } = makeEnv();
    expect((await getDevice(env)).name).toBeNull();
    expect((await setDeviceName(env, { name: "  iPhone  " })).name).toBe("iPhone");
    await expect(setDeviceName(env, { name: "x".repeat(41) })).rejects.toMatchObject({ code: "invalid_body" });
    expect((await buildProgressFile(env)).device.name).toBe("iPhone");
  });
});
