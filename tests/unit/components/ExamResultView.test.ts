// @vitest-environment jsdom
// The result page of a mock exam: score, what went wrong, and (for Schrijven) Claude's feedback per text.
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExamResultView from "../../../src/views/ExamResultView.vue";
import { useSettingsStore } from "../../../src/stores/settings";
import { buttonWith, clickButton, fakeApi, flushPromises, mountApp } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

const mc = (id: string, tag = "knm:wonen") => ({ id, type: "mc", tags: [tag], prompt: `Vraag ${id}`, options: ["goed", "fout", "ook fout"], answer: 0, explanation: `Uitleg ${id}`, difficulty: 1 });
const writing = (id: string) => ({
  id, type: "writing", tags: ["schrijven:kort-bericht"], prompt: `Opdracht ${id}`, explanation: "e", difficulty: 1,
  task: { instructions: "Schrijf.", scenario: "s", requiredPoints: [] }, minWords: 3, maxWords: 20, modelAnswer: `Voorbeeld ${id}`, checklist: ["Aanhef"], register: "informal",
});
const form = {
  id: "f1", type: "form-fill", tags: ["schrijven:formulier"], prompt: "Vul in", explanation: "e", difficulty: 1, scenario: "s", formTitle: "Formulier",
  fields: [{ label: "Naam", hint: "", expected: "Jan" }, { label: "Plaats", hint: "", expected: "Utrecht" }, { label: "Opmerking", hint: "" }],
};

const examOf = (skill: string, items: unknown[], passScore = 0.6) => ({ id: "ex1", skill, title: "Proefexamen", durationMinutes: 30, passScore, items });
const resultOf = (extra: Record<string, unknown>) => ({ id: "res1", examId: "ex1", score: 0, max: 0, answers: {}, details: {}, byTheme: {}, ...extra });

let hasKey: boolean;
beforeEach(() => {
  fakeApi.reset();
  hasKey = false;
  fakeApi.on("GET", "/settings", () => ({ apiKey: hasKey ? "sk-x" : null }));
  fakeApi.on("GET", "/writing", []);
});
function open(exam: unknown, result: unknown) {
  fakeApi.on("GET", "/exams/ex1", exam);
  fakeApi.on("GET", "/exams/results/res1", result);
  return mountApp(ExamResultView, { routePath: "/examen/:id/resultaat/:rid", url: "/examen/ex1/resultaat/res1" });
}

describe("KNM and Lezen results", () => {
  const items = [mc("q1"), mc("q2", "knm:werk"), mc("q3")];

  it("shows the score and whether it is above the practice pass mark", async () => {
    const pass = await open(examOf("knm", items), resultOf({ score: 2, max: 3 }));
    expect(pass.wrapper.text()).toContain("67% · boven onze oefengrens (60%)");
    const fail = await open(examOf("knm", items), resultOf({ score: 1, max: 3 }));
    expect(fail.wrapper.text()).toContain("33% · onder onze oefengrens (60%)");
  });

  it("exactly the pass mark counts as passed", async () => {
    const { wrapper } = await open(examOf("knm", items, 0.5), resultOf({ score: 1, max: 2 }));
    expect(wrapper.text()).toContain("boven onze oefengrens");
  });

  it("lists only the wrong or unanswered questions, with the learner's answer and the right one", async () => {
    const { wrapper } = await open(
      examOf("knm", items),
      resultOf({
        score: 1, max: 3,
        answers: { q1: [1], q2: [0] },
        details: { q1: { correct: false }, q2: { correct: true }, q3: { correct: false } },
      }),
    );
    const text = wrapper.text();
    expect(text).toContain("Fout of niet beantwoord (2)");
    expect(text).toContain("Jouw antwoord: fout");
    expect(text).toContain("Jouw antwoord: Niet beantwoord");
    expect(text).toContain("Goed antwoord: goed");
    expect(text).toContain("Uitleg q1");
    expect(text).not.toContain("Uitleg q2");
  });

  it("offers to practise the mistakes of this exam only when there are any", async () => {
    const some = await open(examOf("knm", items), resultOf({ score: 2, max: 3, details: { q1: { correct: false } } }));
    expect(some.wrapper.find("a[href='/oefenen?exam=res1']").exists()).toBe(true);
    const none = await open(examOf("knm", items), resultOf({ score: 3, max: 3, details: { q1: { correct: true } } }));
    expect(none.wrapper.text()).toContain("Je hebt alle vragen goed beantwoord.");
    expect(none.wrapper.find("a[href='/oefenen?exam=res1']").exists()).toBe(false);
  });

  it("the score per theme starts with the weakest theme and uses the readable theme name", async () => {
    const { wrapper } = await open(examOf("knm", items), resultOf({ score: 3, max: 5, byTheme: { "knm:wonen": [2, 2], "knm:werk": [1, 3] } }));
    const labels = wrapper.findAll("section")[1].text();
    expect(labels.indexOf("Werk en inkomen")).toBeGreaterThan(-1);
    expect(labels.indexOf("Werk en inkomen")).toBeLessThan(labels.indexOf("Wonen"));
  });

  it("an exam without any score says so instead of showing 0%", async () => {
    const { wrapper } = await open(examOf("knm", items), resultOf({ score: 0, max: 0 }));
    expect(wrapper.text()).toContain("Er is nog geen score.");
    expect(wrapper.text()).not.toContain("oefengrens (");
  });

  it("a load error is shown", async () => {
    fakeApi.fail("GET", "/exams/ex1", "Examen niet gevonden.");
    fakeApi.on("GET", "/exams/results/res1", resultOf({}));
    const { wrapper } = await mountApp(ExamResultView, { routePath: "/examen/:id/resultaat/:rid", url: "/examen/ex1/resultaat/res1" });
    expect(wrapper.text()).toContain("Examen niet gevonden.");
  });
});

describe("Schrijven results", () => {
  const exam = examOf("schrijven", [writing("w1"), writing("w2"), form]);
  const pending = {
    score: 3, max: 9,
    answers: { w1: "mijn eerste tekst", w2: "mijn tweede tekst", f1: ["jan", "Zeist", ""] },
    details: { w1: { submissionId: "s1" }, w2: { submissionId: "s2" }, f1: { points: 1, max: 2 } },
  };

  it("without an API key the texts are shown with the example and checklist, and no request is made to Claude", async () => {
    const { wrapper } = await open(exam, resultOf(pending));
    expect(wrapper.text()).toContain("Geen API-sleutel");
    expect(wrapper.text()).toContain("mijn eerste tekst");
    expect(wrapper.text()).toContain("Voorbeeld w1");
    expect(wrapper.text()).toContain("Voorlopige score");
    expect(fakeApi.to("POST", "/claude/feedback-writing")).toHaveLength(0);
  });

  it("form answers are marked field by field; a field without a right answer is neutral", async () => {
    const { wrapper } = await open(exam, resultOf(pending));
    const rows = wrapper.findAll("li").map((li) => li.text());
    expect(rows.find((r) => r.includes("Naam"))).toMatch(/^✓\s*Naam:\s*jan$/);
    expect(rows.find((r) => r.includes("Plaats"))).toMatch(/^✗\s*Plaats:\s*Zeist\s*→\s*Utrecht$/);
    expect(rows.find((r) => r.includes("Opmerking"))).toMatch(/^•\s*Opmerking:\s*\(leeg\)$/);
  });

  it("with a key, every text without a score is sent to Claude one after the other, and the result is reloaded after each", async () => {
    hasKey = true;
    fakeApi.on("POST", "/claude/feedback-writing", {});
    await open(exam, resultOf(pending));
    expect(fakeApi.to("POST", "/claude/feedback-writing").map((c) => c.body)).toEqual([
      { exerciseId: "w1", submissionId: "s1", examResultId: "res1" },
      { exerciseId: "w2", submissionId: "s2", examResultId: "res1" },
    ]);
    expect(fakeApi.to("GET", "/exams/results/res1")).toHaveLength(3); // first load + after each text
  });

  it("a text that already has points is not sent again", async () => {
    hasKey = true;
    fakeApi.on("POST", "/claude/feedback-writing", {});
    const done = { ...pending, details: { ...pending.details, w1: { submissionId: "s1", points: 4, max: 6 } } };
    await open(exam, resultOf(done));
    expect(fakeApi.to("POST", "/claude/feedback-writing").map((c: any) => c.body.exerciseId)).toEqual(["w2"]);
  });

  it("when one text fails the others still get judged, the error is shown, and 'Probeer opnieuw' retries", async () => {
    hasKey = true;
    let failFirst = true;
    fakeApi.on("POST", "/claude/feedback-writing", (body: any) => {
      if (body.exerciseId === "w1" && failFirst) throw new Error("Claude is er even niet.");
      return {};
    });
    const { wrapper } = await open(exam, resultOf(pending));
    expect(fakeApi.to("POST", "/claude/feedback-writing")).toHaveLength(2);
    expect(wrapper.text()).toContain("Claude is er even niet.");
    expect(wrapper.text()).toContain("Een beoordeling is niet gelukt. Je teksten zijn opgeslagen.");
    failFirst = false;
    await clickButton(wrapper, "Probeer opnieuw");
    expect(fakeApi.to("POST", "/claude/feedback-writing").map((c: any) => c.body.exerciseId)).toEqual(["w1", "w2", "w1", "w2"]);
  });

  it("the final score appears once every text has points", async () => {
    const done = { score: 7, max: 9, answers: pending.answers, details: { w1: { submissionId: "s1", points: 3, max: 3 }, w2: { submissionId: "s2", points: 3, max: 3 }, f1: { points: 1, max: 2 } } };
    const { wrapper } = await open(exam, resultOf(done));
    expect(wrapper.text()).not.toContain("Voorlopige score");
    expect(wrapper.text()).toContain("78%");
  });

  it("never asks Claude on a KNM exam, even with a key", async () => {
    hasKey = true;
    await open(examOf("knm", [mc("q1")]), resultOf({ score: 1, max: 1 }));
    expect(fakeApi.calls.filter((c) => c.path.includes("/claude/"))).toHaveLength(0);
  });
});
