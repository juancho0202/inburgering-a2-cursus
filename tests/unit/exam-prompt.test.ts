import { describe, expect, it } from "vitest";
import { claimExamPrompt, stopExamPrompt } from "../../shared/services/examPrompt";
import { completeUnit } from "../../shared/services/progress";
import { startExam, submitExam } from "../../shared/services/exams";
import { getSettings, updateSettings } from "../../shared/services/settings";
import { dashboard } from "../../shared/services/dashboard";
import { makeEnv } from "../helpers/fixtures";

/** A learner who has finished two lessons, so the card may be shown. */
async function activeLearner() {
  const made = makeEnv();
  await completeUnit(made.env, "basis-a", { score: 1 });
  await completeUnit(made.env, "knm-wonen", { score: 1 });
  return made;
}

describe("'Wanneer is je examen?' after a lesson or mock exam", () => {
  it("is not shown after the first lesson, only from the second", async () => {
    const { env } = makeEnv();
    await completeUnit(env, "basis-a", { score: 1 });
    expect(await claimExamPrompt(env)).toEqual({ show: false });
    await completeUnit(env, "knm-wonen", { score: 1 });
    expect(await claimExamPrompt(env)).toEqual({ show: true });
  });

  it("a handed-in mock exam is enough, even before two lessons", async () => {
    const { env } = makeEnv();
    const { result } = await startExam(env, "exam-knm-t");
    expect(await claimExamPrompt(env)).toEqual({ show: false }); // started, not handed in
    await submitExam(env, result.id, { answers: {} });
    expect(await claimExamPrompt(env)).toEqual({ show: true });
  });

  it("is shown at most 3 times, at least 3 days apart", async () => {
    const { env, clock } = await activeLearner();
    expect((await claimExamPrompt(env)).show).toBe(true);
    expect((await claimExamPrompt(env)).show).toBe(false); // the next lesson, same day
    clock.advanceDays(2);
    expect((await claimExamPrompt(env)).show).toBe(false);
    clock.advanceDays(1);
    expect((await claimExamPrompt(env)).show).toBe(true);
    clock.advanceDays(3);
    expect((await claimExamPrompt(env)).show).toBe(true);
    clock.advanceDays(30);
    expect((await claimExamPrompt(env)).show).toBe(false);
    expect((await getSettings(env)).examPrompt).toMatchObject({ shown: 3 });
  });

  it("stops for good after 'Niet meer vragen', also on the dashboard", async () => {
    const { env, clock } = await activeLearner();
    expect((await dashboard(env)).askExamDate).toBe(true);
    await stopExamPrompt(env);
    clock.advanceDays(10);
    expect((await claimExamPrompt(env)).show).toBe(false);
    expect((await dashboard(env)).askExamDate).toBe(false);
  });

  it("stops once an exam date is set, also when that date has passed", async () => {
    const { env, clock } = await activeLearner();
    await updateSettings(env, { examDates: { knm: "2026-10-20" } });
    expect((await claimExamPrompt(env)).show).toBe(false);
    clock.advanceDays(30);
    expect((await claimExamPrompt(env)).show).toBe(false);
    // A passed date leaves no plan: the dashboard asks again (for a retake).
    expect((await dashboard(env)).askExamDate).toBe(true);
  });

  it("the count goes along in the settings, so another device does not ask again", async () => {
    const { env } = await activeLearner();
    await claimExamPrompt(env);
    await stopExamPrompt(env);
    expect((await getSettings(env)).examPrompt).toEqual({ shown: 1, lastShown: "2026-10-05", never: true });
  });
});
