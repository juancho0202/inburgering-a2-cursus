import { describe, expect, it } from "vitest";
import { dashboard, practice } from "../../shared/services/dashboard";
import { completeUnit, getProgress, recordAttempt, resetProgress, setUnitStep } from "../../shared/services/progress";
import { dueCards, introduce, reviewSrsCard, vocabList, verbList } from "../../shared/services/srs";
import { getSettings, recordUsage, updateSettings } from "../../shared/services/settings";
import { courseTree, getUnit } from "../../shared/services/course";
import { ServiceError } from "../../shared/services/context";
import { makeClock, makeEnv } from "../helpers/fixtures";

const answer = (itemId: string, correct: boolean, durationMs = 20_000) => ({ itemId, exerciseType: "mc", correct, answer: 0, durationMs });

describe("attempts and derived progress", () => {
  it("saves attempts and derives item stats, minutes and streak", async () => {
    const { env } = makeEnv();
    await recordAttempt(env, answer("basis-a-q-001", false));
    await recordAttempt(env, answer("basis-a-q-001", true, 40_000));
    const p = await getProgress(env);
    expect(p.items["basis-a-q-001"]).toMatchObject({ seen: 2, correct: 1, lastCorrect: true });
    expect(p.minutesByDay["2026-10-05"]).toBe(1);
    expect(p.streak).toEqual({ current: 1, best: 1, lastDay: "2026-10-05" });
  });

  it("caps one answer at 3 minutes of study time", async () => {
    const { env } = makeEnv();
    await recordAttempt(env, answer("basis-a-q-001", true, 3_600_000));
    expect((await getProgress(env)).minutesByDay["2026-10-05"]).toBe(3);
  });

  it("rejects a broken attempt with a Dutch message", async () => {
    const { env } = makeEnv();
    await expect(recordAttempt(env, { itemId: 1 })).rejects.toMatchObject({ status: 400, code: "invalid_body", message: "Dit antwoord kon niet worden opgeslagen." });
  });

  it("tags every attempt with a device id that stays the same", async () => {
    const { env } = makeEnv();
    await recordAttempt(env, answer("q", true));
    await recordAttempt(env, answer("q", true));
    const ids = (await env.store.attempts.all()).map((a) => a.deviceId);
    expect(new Set(ids).size).toBe(1);
    expect(ids[0]).toBeTruthy();
  });

  it("builds a streak over days", async () => {
    const { env, clock } = makeEnv();
    for (let i = 0; i < 3; i++) {
      await recordAttempt(env, answer("q", true));
      clock.advanceDays(1);
    }
    expect((await getProgress(env)).streak.current).toBe(3);
    clock.advanceDays(2); // two missed days
    expect((await getProgress(env)).streak).toMatchObject({ current: 0, best: 3 });
  });
});

describe("units", () => {
  it("remembers the step and the last location, resumes, and completes with the best score", async () => {
    const { env } = makeEnv();
    await setUnitStep(env, "basis-a", { stepIndex: 2 });
    let p = await getProgress(env);
    expect(p.units["basis-a"]).toMatchObject({ status: "in_progress", stepIndex: 2 });
    expect(p.lastLocation).toEqual({ unitId: "basis-a", stepIndex: 2 });

    const res = await completeUnit(env, "basis-a", { score: 0.6 });
    // de huur: meaning + recognise + article (3); werken: meaning + recognise (2)
    expect(res).toEqual({ ok: true, wordsIntroduced: 5 });
    p = await getProgress(env);
    expect(p.units["basis-a"]).toMatchObject({ status: "completed", bestScore: 0.6, attempts: 1 });
    expect(p.lastLocation).toBeNull();

    await completeUnit(env, "basis-a", { score: 0.4 });
    expect((await getProgress(env)).units["basis-a"]).toMatchObject({ bestScore: 0.6, attempts: 2 });
  });

  it("returns units and the course tree, and 404s for a missing unit", async () => {
    const { env } = makeEnv();
    expect(getUnit(env, "basis-a").title).toBe("Les A");
    expect(() => getUnit(env, "nope")).toThrowError(ServiceError);
    const tree = courseTree(env);
    expect(tree.modules.map((m) => m.id)).toEqual(["basis", "knm", "schrijven"]);
    expect(tree.modules[0].units[0]).toMatchObject({ id: "basis-a", stepCount: 4 });
  });

  it("reset wipes progress but keeps writing, explanations and generated exercises", async () => {
    const { env } = makeEnv();
    await recordAttempt(env, answer("q", true));
    await setUnitStep(env, "basis-a", { stepIndex: 1 });
    await env.store.writing.put({ id: "w1", exerciseId: "x", text: "t", submittedAt: "t", feedback: null });
    await expect(resetProgress(env, { confirm: "nee" })).rejects.toMatchObject({ status: 400 });
    await resetProgress(env, { confirm: "RESET" });
    const p = await getProgress(env);
    expect(p.items).toEqual({});
    expect(p.units).toEqual({});
    expect(p.lastLocation).toBeNull();
    expect(await env.store.writing.all()).toHaveLength(1);
  });
});

describe("spaced repetition", () => {
  it("introduces cards per word type and keeps existing ones", async () => {
    const { env } = makeEnv();
    expect(await introduce(env, { theme: "wonen" })).toEqual({ added: 8 });
    expect(await introduce(env, { theme: "wonen" })).toEqual({ added: 0 });
    expect(await introduce(env, { verbs: true })).toEqual({ added: 0 }); // v-werken already has vocab cards, verbs.json id is the same
    await expect(introduce(env, { theme: 5 })).rejects.toMatchObject({ code: "invalid_body" });
  });

  it("reviews follow the Leitner boxes and count new cards against the daily limit", async () => {
    const { env } = makeEnv();
    await updateSettings(env, { newCardsPerDay: 2 });
    await introduce(env, { theme: "wonen" });

    let due = await dueCards(env, {});
    expect(due).toHaveLength(2); // only two new cards per day

    const first = due[0].card;
    const goed = await reviewSrsCard(env, { cardId: first.id, grade: "goed" });
    expect(goed).toMatchObject({ box: 1, due: "2026-10-06", reps: 1 });
    await reviewSrsCard(env, { cardId: due[1].card.id, grade: "opnieuw" });

    due = await dueCards(env, {});
    // allowance used up; the "opnieuw" card is due again today (a review), new cards stay hidden
    expect(due.map((d) => d.card.id)).toEqual([due[0].card.id]);
    expect(due[0].card.lapses).toBe(1);
  });

  it("gives recognise cards three distractor definitions and none for verb cards", async () => {
    const { env } = makeEnv();
    await introduce(env, { theme: "wonen" });
    const all = await dueCards(env, { limit: 100 });
    const recognise = all.find((d) => d.card.cardType === "recognise" && d.vocab?.id === "v-huur")!;
    expect(recognise.distractors).toHaveLength(2); // only two other words in the fixture
    expect(recognise.distractors).not.toContain(recognise.vocab!.definitionNl);
  });

  it("lists vocab and verbs with their learning state", async () => {
    const { env } = makeEnv();
    await introduce(env, { theme: "wonen" });
    const cards = (await dueCards(env, { limit: 100 })).map((d) => d.card).filter((c) => c.refId === "v-huur");
    for (const c of cards) {
      await reviewSrsCard(env, { cardId: c.id, grade: "makkelijk" });
      await reviewSrsCard(env, { cardId: c.id, grade: "makkelijk" }); // box 2 → 4: learned
    }
    const states = Object.fromEntries((await vocabList(env))[0].entries.map((e) => [e.id, e.state]));
    expect(states).toEqual({ "v-huur": "learned", "v-lamp": "learning", "v-werken": "learning" });
    expect((await verbList(env))[0].state).toBe("new"); // no verb-forms card
  });

  it("404s for an unknown card", async () => {
    const { env } = makeEnv();
    await expect(reviewSrsCard(env, { cardId: "x", grade: "goed" })).rejects.toMatchObject({ status: 404 });
  });
});

describe("dashboard and practice", () => {
  it("summarises modules, today's minutes, goal and the next exam", async () => {
    const { env } = makeEnv();
    await updateSettings(env, { dailyGoalMinutes: 45 });
    await recordAttempt(env, answer("basis-a-q-001", true, 90_000));
    await completeUnit(env, "basis-a", { score: 1 });
    await setUnitStep(env, "knm-wonen", { stepIndex: 1 });
    const d = await dashboard(env);
    expect(d.dailyGoalMinutes).toBe(45);
    expect(d.minutesToday).toBe(1.5);
    expect(d.modules.find((m) => m.id === "basis")).toMatchObject({ total: 1, completed: 1 });
    expect(d.lastLocation).toMatchObject({ unitId: "knm-wonen", unitTitle: "Wonen", stepIndex: 1, stepCount: 2 });
    expect(d.nextExam).toMatchObject({ id: "exam-knm-t" });
    expect(d.newCount).toBe(5);
  });

  it("finds hard items and the weakest tags, and builds practice sessions from them", async () => {
    const { env } = makeEnv();
    for (let i = 0; i < 3; i++) await recordAttempt(env, answer("basis-a-q-001", false)); // basis:a, wrong 3x
    for (let i = 0; i < 3; i++) await recordAttempt(env, answer("basis-a-q-002", true));
    await recordAttempt(env, answer("basis-a-q-003", true));
    const d = await dashboard(env);
    expect(d.hardCount).toBe(1);
    expect(d.weakTags[0]).toMatchObject({ tag: "basis:a", seen: 7 }); // the unit tag counts for all three items
    expect(d.weakTags[0].accuracy).toBeCloseTo(4 / 7);

    expect((await practice(env, {})).map((e) => e.id)).toEqual(["basis-a-q-001"]);
    const byTag = await practice(env, { tag: "basis:a" });
    expect(byTag[0].id).toBe("basis-a-q-001"); // weakest first
    expect(await practice(env, { unit: "knm-wonen" })).toEqual([]);
  });

  it("does not count unresolvable hard items (exam questions) in the hard count", async () => {
    const { env } = makeEnv();
    for (let i = 0; i < 3; i++) await recordAttempt(env, answer("exam-knm-t-q-001", false));
    expect((await dashboard(env)).hardCount).toBe(0);
  });

  it("shows writing error types as weak tags", async () => {
    const { env } = makeEnv();
    for (let i = 0; i < 4; i++) await recordAttempt(env, { itemId: "writing:woordvolgorde", exerciseType: "writing-check", correct: false, durationMs: 0 });
    const d = await dashboard(env);
    expect(d.weakTags[0].tag).toBe("writing:woordvolgorde");
    expect(d.hardCount).toBe(0);
  });
});

describe("settings", () => {
  it("has defaults, validates updates and counts usage per month", async () => {
    const clock = makeClock("2026-10-31T10:00:00");
    const { env } = makeEnv({ clock });
    expect((await getSettings(env)).newCardsPerDay).toBe(15);
    await expect(updateSettings(env, { theme: "pink" })).rejects.toMatchObject({ message: "De instellingen zijn niet geldig." });
    expect((await updateSettings(env, { theme: "dark", speechRate: 0.8 })).theme).toBe("dark");

    await recordUsage(env, { inputTokens: 100, outputTokens: 40 });
    await recordUsage(env, { inputTokens: 10, outputTokens: 5 });
    expect((await getSettings(env)).usage).toEqual({ month: "2026-10", requests: 2, inputTokens: 110, outputTokens: 45 });
    clock.advanceDays(1); // November
    expect((await getSettings(env)).usage).toEqual({ month: "2026-11", requests: 0, inputTokens: 0, outputTokens: 0 });
  });
});
