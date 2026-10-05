import { describe, expect, it } from "vitest";
import { feedbackWriting, explain, generate, flagGenerated } from "../../shared/services/claude";
import { examMistakes, getExamResult, listExams, saveExamState, startExam, submitExam } from "../../shared/services/exams";
import { dashboard, practice } from "../../shared/services/dashboard";
import { getProgress } from "../../shared/services/progress";
import { getSettings } from "../../shared/services/settings";
import { listWriting } from "../../shared/services/writing";
import { fakeGateway, makeClock, makeEnv } from "../helpers/fixtures";

describe("mock exams", () => {
  it("starts once, resumes the same attempt and keeps counting from the wall clock", async () => {
    const { env, clock } = makeEnv();
    const first = await startExam(env, "exam-knm-t");
    expect(first.remainingMs).toBe(45 * 60_000);
    clock.advanceMs(10 * 60_000);
    const again = await startExam(env, "exam-knm-t");
    expect(again.result.id).toBe(first.result.id);
    expect(again.remainingMs).toBe(35 * 60_000);
    expect((await listExams(env)).find((e) => e.id === "exam-knm-t")).toMatchObject({ inProgress: { id: first.result.id }, attempts: [], questionCount: 3 });
  });

  it("saves answers, flags and position continuously", async () => {
    const { env } = makeEnv();
    const { result } = await startExam(env, "exam-knm-t");
    await saveExamState(env, result.id, { answers: { "exam-knm-t-q-001": [0] }, flagged: ["exam-knm-t-q-002"], position: 1 });
    const resumed = (await startExam(env, "exam-knm-t")).result;
    expect(resumed).toMatchObject({ answers: { "exam-knm-t-q-001": [0] }, flagged: ["exam-knm-t-q-002"], position: 1 });
  });

  it("grades a KNM exam per theme, logs attempts and study time, and refuses later saves", async () => {
    const { env, clock } = makeEnv();
    const { result } = await startExam(env, "exam-knm-t");
    clock.advanceMs(20 * 60_000);
    const done = await submitExam(env, result.id, { answers: { "exam-knm-t-q-001": [0], "exam-knm-t-q-002": [1] } });
    expect(done).toMatchObject({ score: 1, max: 3, byTheme: { "knm:wonen": [1, 2], "knm:werk": [0, 1] } });
    expect(done.finishedAt).toBeTruthy();

    const p = await getProgress(env);
    expect(p.items["exam-knm-t-q-001"]).toMatchObject({ seen: 1, correct: 1 });
    expect(p.minutesByDay["2026-10-05"]).toBe(20);

    await expect(saveExamState(env, result.id, { answers: {} })).rejects.toMatchObject({ status: 409, code: "finished" });
    expect((await submitExam(env, result.id, {})).score).toBe(1); // handing in twice changes nothing
    expect((await listExams(env)).find((e) => e.id === "exam-knm-t")!.attempts).toEqual([expect.objectContaining({ score: 1, max: 3 })]);
  });

  it("counts at most the exam duration as study time", async () => {
    const { env, clock } = makeEnv();
    const { result } = await startExam(env, "exam-knm-t");
    clock.advanceMs(5 * 3_600_000); // left the tab open for five hours
    await submitExam(env, result.id, { answers: {} });
    expect((await getProgress(env)).minutesByDay["2026-10-05"]).toBe(45);
  });

  it("lists wrong and unanswered questions as mistakes, and starts a new attempt after finishing", async () => {
    const { env } = makeEnv();
    const { result } = await startExam(env, "exam-knm-t");
    await submitExam(env, result.id, { answers: { "exam-knm-t-q-001": [0], "exam-knm-t-q-002": [2] } });
    expect((await examMistakes(env, result.id)).map((e) => e.id)).toEqual(["exam-knm-t-q-002", "exam-knm-t-q-003"]);
    expect((await startExam(env, "exam-knm-t")).result.id).not.toBe(result.id);
    expect((await dashboard(env)).nextExam).toMatchObject({ id: "exam-schrijven-t" });
  });

  it("grades the form of a Schrijven exam and scores the texts with Claude feedback", async () => {
    const feedback = { overall: "bijna", score: 7, criteria: [], missingPoints: [], corrections: [{ original: "Ik zijn", corrected: "Ik ben", type: "werkwoord", explanation: "x" }], correctedText: "x", strongPoints: [], nextTip: "t" };
    const { gateway } = fakeGateway(() => feedback);
    const { env } = makeEnv({ gateway: () => gateway });
    const { result } = await startExam(env, "exam-schrijven-t");
    const done = await submitExam(env, result.id, { answers: { "exam-schrijven-t-q-001": ["amira", "Zwolle"], "exam-schrijven-t-q-002": "Hoi Pieter, ik zijn zaterdag niet thuis, kun je mijn pakket aannemen?" } });

    // form: 1 of 2 fields right → 5 of 10 points. The text still waits for feedback.
    expect(done).toMatchObject({ score: 5, max: 10 });
    const sid = (done.details["exam-schrijven-t-q-002"] as { submissionId: string }).submissionId;
    expect(await env.store.writing.get(sid)).toMatchObject({ exerciseId: "exam-schrijven-t-q-002", feedback: null });

    await feedbackWriting(env, { exerciseId: "exam-schrijven-t-q-002", submissionId: sid, examResultId: result.id });
    expect(await getExamResult(env, result.id)).toMatchObject({ score: 12, max: 20 });

    const history = await listWriting(env);
    expect(history[0]).toMatchObject({ id: sid, task: { type: "informeel", register: "informal" } }); // exam tasks are found too
    expect(history[0].feedback?.overall).toBe("bijna");
  });

  it("scores an empty text with zero points", async () => {
    const { env } = makeEnv();
    const { result } = await startExam(env, "exam-schrijven-t");
    const done = await submitExam(env, result.id, { answers: { "exam-schrijven-t-q-001": ["Amira", "Utrecht"] } });
    expect(done).toMatchObject({ score: 10, max: 20 });
    expect(done.details["exam-schrijven-t-q-002"]).toMatchObject({ points: 0, submissionId: null });
  });
});

const goodFeedback = { overall: "voldoende", score: 8, criteria: [{ name: "Opdracht", score: 3, comment: "Goed" }], missingPoints: [], corrections: [], correctedText: "x", strongPoints: ["Netjes"], nextTip: "Oefen." };

describe("writing feedback", () => {
  it("saves the text first and keeps it when Claude fails, then retries on the same submission", async () => {
    let fail = true;
    const { gateway } = fakeGateway(() => {
      if (fail) throw Object.assign(new Error("boom"), { status: 503 });
      return goodFeedback;
    });
    const { env } = makeEnv({ gateway: () => gateway });

    const err = await feedbackWriting(env, { exerciseId: "schrijven-kort-q-001", text: "Hoi buurman, zaterdag geef ik een feestje." }).catch((e) => e);
    expect(err).toMatchObject({ status: 502, code: "claude_error", message: "Claude is even niet bereikbaar. Je antwoord is wel opgeslagen." });
    const submissionId = err.extra.submissionId as string;
    expect(await env.store.writing.get(submissionId)).toMatchObject({ text: "Hoi buurman, zaterdag geef ik een feestje.", feedback: null });

    fail = false;
    const ok = await feedbackWriting(env, { exerciseId: "schrijven-kort-q-001", submissionId });
    expect(ok.feedback.overall).toBe("voldoende");
    expect((await env.store.writing.get(submissionId))?.feedback).not.toBeNull();
    expect(await env.store.writing.all()).toHaveLength(1); // no duplicate submission
    expect((await getSettings(env)).usage).toMatchObject({ requests: 1, inputTokens: 100, outputTokens: 50 });
  });

  it("records one writing check per error type, so error types can become weak spots", async () => {
    const withErrors = { ...goodFeedback, overall: "bijna", corrections: [{ original: "a", corrected: "b", type: "woordvolgorde", explanation: "x" }] };
    const { gateway } = fakeGateway(() => withErrors);
    const { env } = makeEnv({ gateway: () => gateway });
    await feedbackWriting(env, { exerciseId: "schrijven-kort-q-001", text: "tekst" });
    const checks = (await env.store.attempts.all()).filter((a) => a.exerciseType === "writing-check");
    expect(checks).toHaveLength(7);
    expect(checks.find((c) => c.itemId === "writing:woordvolgorde")?.correct).toBe(false);
    expect(checks.find((c) => c.itemId === "writing:spelling")?.correct).toBe(true);
  });

  it("explains missing key, wrong output and bad input in Dutch", async () => {
    const noKey = makeEnv();
    await expect(feedbackWriting(noKey.env, { exerciseId: "schrijven-kort-q-001", text: "t" })).rejects.toMatchObject({ status: 503, code: "no_api_key", extra: { submissionId: expect.any(String) } });

    const bad = makeEnv({ gateway: () => fakeGateway(() => "geen json").gateway });
    await expect(feedbackWriting(bad.env, { exerciseId: "schrijven-kort-q-001", text: "t" })).rejects.toMatchObject({ status: 502, code: "bad_answer" });

    await expect(feedbackWriting(bad.env, { exerciseId: "nope", text: "t" })).rejects.toMatchObject({ status: 404 });
    await expect(feedbackWriting(bad.env, { exerciseId: "schrijven-kort-q-001", text: "  " })).rejects.toMatchObject({ status: 400, message: "Schrijf eerst een tekst." });
  });
});

describe("explain a mistake", () => {
  it("asks Claude once per (item, answer) and caches the explanation", async () => {
    const { gateway, calls } = fakeGateway(() => ({ explanation: "Kijk naar de regel.", rule: null, extraExamples: ["Ik ben moe."] }));
    const { env } = makeEnv({ gateway: () => gateway });
    const first = await explain(env, { itemId: "basis-a-q-001", learnerAnswer: 1 });
    expect(first).toMatchObject({ explanation: "Kijk naar de regel.", cached: false });
    expect(calls[0].user).toContain("Antwoord van de cursist: fout"); // index 1 → option text
    expect((await explain(env, { itemId: "basis-a-q-001", learnerAnswer: 1 })).cached).toBe(true);
    await explain(env, { itemId: "basis-a-q-001", learnerAnswer: 2 });
    expect(calls).toHaveLength(2);
  });

  it("works for reading sub-questions and for exam questions", async () => {
    const { gateway } = fakeGateway(() => ({ explanation: "Uitleg", rule: "Regel", extraExamples: [] }));
    const { env } = makeEnv({ gateway: () => gateway });
    expect((await explain(env, { itemId: "knm-wonen-q-002-2", learnerAnswer: 0 })).rule).toBe("Regel");
    expect((await explain(env, { itemId: "exam-knm-t-q-001", learnerAnswer: 1 })).explanation).toBe("Uitleg");
    await expect(explain(env, { itemId: "nope", learnerAnswer: 0 })).rejects.toMatchObject({ status: 404 });
  });

  it("serves a cached explanation even without a key", async () => {
    const { gateway } = fakeGateway(() => ({ explanation: "Uitleg", rule: null, extraExamples: [] }));
    const withKey = makeEnv({ gateway: () => gateway });
    await explain(withKey.env, { itemId: "basis-a-q-001", learnerAnswer: 1 });
    const offline = { ...withKey.env, gateway: undefined };
    expect((await explain(offline, { itemId: "basis-a-q-001", learnerAnswer: 1 })).cached).toBe(true);
  });
});

describe("generated exercises", () => {
  const reply = { exercises: [
    { prompt: "Wie betaalt de huur?", options: ["De huurder", "De buurman", "De koning"], answer: 0, explanation: "De huurder betaalt." },
    { prompt: "Kapot", options: ["a", "b"], answer: 9, explanation: "Fout index" },
  ] };

  it("stores valid exercises as user data, drops broken ones and uses the KNM facts", async () => {
    const { gateway, calls } = fakeGateway(() => reply);
    const { env } = makeEnv({ gateway: () => gateway });
    const res = await generate(env, { unitId: "knm-wonen", type: "mc", count: 5 });
    expect(res).toMatchObject({ unitId: "knm-wonen", dropped: 1 });
    expect(res.exercises).toHaveLength(1);
    expect(calls[0].user).toContain("Feit over wonen");
    expect(calls[0].user).toContain("Verzin geen feiten");

    const stored = await env.store.generated.all();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ unitId: "knm-wonen", hidden: false });

    const session = await practice(env, { generated: "knm-wonen" });
    expect(session.map((e) => e.id)).toEqual([res.exercises[0].id]);
    expect((await practice(env, { tag: "knm:wonen" })).map((e) => e.id)).toContain(res.exercises[0].id);
  });

  it("finds the unit from a tag, and hides an exercise that is flagged", async () => {
    const { gateway } = fakeGateway(() => reply);
    const { env } = makeEnv({ gateway: () => gateway });
    const res = await generate(env, { tag: "basis:a", type: "mc", count: 6 });
    expect(res.unitId).toBe("basis-a");
    await flagGenerated(env, res.exercises[0].id);
    expect(await practice(env, { generated: "basis-a" })).toEqual([]);
    await expect(flagGenerated(env, "gen-nope")).rejects.toMatchObject({ status: 404 });
  });

  it("rejects bad requests and an all-broken answer", async () => {
    const { gateway } = fakeGateway(() => ({ exercises: [{ prompt: "p", options: ["a", "a"], answer: 0, explanation: "e" }] }));
    const { env } = makeEnv({ gateway: () => gateway });
    await expect(generate(env, { unitId: "knm-wonen", type: "mc", count: 3 })).rejects.toMatchObject({ code: "invalid_body" });
    await expect(generate(env, { type: "mc", count: 5 })).rejects.toMatchObject({ code: "invalid_body" });
    await expect(generate(env, { unitId: "nope", type: "mc", count: 5 })).rejects.toMatchObject({ status: 404 });
    await expect(generate(env, { unitId: "knm-wonen", type: "mc", count: 5 })).rejects.toMatchObject({ status: 502, code: "bad_answer" });
    expect(await env.store.generated.all()).toEqual([]);
  });
});
