import { beforeAll, describe, expect, it } from "vitest";
import type { Content } from "../../shared/content/types";
import { courseTree } from "../../shared/services/course";
import { dashboard } from "../../shared/services/dashboard";
import { startExam, submitExam } from "../../shared/services/exams";
import { generate } from "../../shared/services/claude";
import { completeUnit, getProgress } from "../../shared/services/progress";
import { dueCards } from "../../shared/services/srs";
import { examQuestions } from "../../shared/logic/exam";
import { fakeGateway, makeEnv } from "../helpers/fixtures";
import { realContent } from "../helpers/realContent";

let content: Content;
beforeAll(async () => {
  content = await realContent();
});

describe("services on the real course", () => {
  it("shows all five modules and a dashboard on an empty store", async () => {
    const { env } = makeEnv({ content });
    expect(courseTree(env).modules.map((m) => m.id)).toEqual(["basis", "lezen", "knm", "schrijven", "exams"]);
    const d = await dashboard(env);
    expect(d.modules.every((m) => m.completed === 0)).toBe(true);
    expect(d.nextExam).not.toBeNull();
  });

  it("completing a unit introduces its words as cards", async () => {
    const { env } = makeEnv({ content });
    const unit = content.units.get("basis-tijd")!;
    const res = await completeUnit(env, unit.id, { score: 1 });
    expect(res.wordsIntroduced).toBeGreaterThan(5);
    expect((await dueCards(env, { limit: 100 })).length).toBeGreaterThan(0);
    expect((await getProgress(env)).units["basis-tijd"].status).toBe("completed");
  });

  it("a perfect KNM exam scores 40/40 with 5 questions per theme", async () => {
    const { env } = makeEnv({ content });
    const exam = content.exams.get("exam-knm-1")!;
    const { result } = await startExam(env, exam.id);
    const answers = Object.fromEntries(examQuestions(exam).map((q) => [q.id, [q.exercise.type === "mc" ? q.exercise.answer : 0]]));
    const done = await submitExam(env, result.id, { answers });
    expect(done).toMatchObject({ score: 40, max: 40 });
    expect(Object.values(done.byTheme!).every(([good, total]) => good === 5 && total === 5)).toBe(true);
  });

  it("generation for a KNM unit sends the real facts", async () => {
    const { gateway, calls } = fakeGateway(() => ({ exercises: [{ prompt: "Wie betaalt grote reparaties?", options: ["De verhuurder", "De huurder", "De buren"], answer: 0, explanation: "De verhuurder." }] }));
    const { env } = makeEnv({ content, gateway: () => gateway });
    await generate(env, { unitId: "knm-wonen", type: "mc", count: 5 });
    expect(calls[0].user).toContain("woningcorporatie");
  });
});
