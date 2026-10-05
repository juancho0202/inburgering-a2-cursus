import { describe, expect, it } from "vitest";
import type { ClaudeGateway } from "../../shared/claude/gateway";
import { explainMistake, generateExercises, writingFeedback } from "../../shared/claude/services";
import { describeAnswer, describeCorrect } from "../../shared/claude/describe";
import { writingFeedbackUser } from "../../shared/claude/prompts";
import type { Exercise } from "../../shared/types";

const fake = (reply: unknown): ClaudeGateway & { calls: { system: string; user: string }[] } => {
  const calls: { system: string; user: string }[] = [];
  return {
    calls,
    async complete(args) {
      calls.push({ system: args.system, user: args.user });
      return { text: typeof reply === "string" ? reply : JSON.stringify(reply), usage: { inputTokens: 10, outputTokens: 20 } };
    },
  };
};

const writing = {
  id: "w1", type: "writing", tags: [], prompt: "Schrijf", explanation: "e", difficulty: 1,
  task: { instructions: "Schrijf een e-mail.", scenario: "De verwarming is kapot.", requiredPoints: ["Het probleem", "Sinds wanneer"] },
  minWords: 40, maxWords: 100, modelAnswer: "GEHEIM VOORBEELD", checklist: ["x"], register: "formal",
} as Extract<Exercise, { type: "writing" }>;

const goodFeedback = {
  overall: "voldoende", score: 8,
  criteria: [{ name: "Opdracht", score: 3, comment: "Goed" }],
  missingPoints: [], corrections: [], correctedText: "x", strongPoints: ["Netjes"], nextTip: "Oefen meer.",
};

describe("claude services (fake gateway)", () => {
  it("writing feedback: validates the answer and never sends the model answer", async () => {
    const gw = fake(goodFeedback);
    const { feedback, usage } = await writingFeedback(gw, writing, "Hallo, de verwarming is kapot.");
    expect(feedback.overall).toBe("voldoende");
    expect(usage.outputTokens).toBe(20);
    expect(gw.calls[0].user).toContain("De verwarming is kapot.");
    expect(gw.calls[0].user).toContain("- Sinds wanneer");
    expect(gw.calls[0].user).not.toContain("GEHEIM VOORBEELD");
  });

  it("writing feedback: rejects malformed model output", async () => {
    await expect(writingFeedback(fake({ ...goodFeedback, overall: "geweldig" }), writing, "tekst")).rejects.toThrow();
    await expect(writingFeedback(fake("geen json"), writing, "tekst")).rejects.toThrow();
  });

  it("user prompt states the word count", () => {
    expect(writingFeedbackUser(writing, "een twee drie", 3)).toContain("De cursist schreef 3 woorden.");
  });

  it("explain mistake parses the explanation", async () => {
    const { explanation } = await explainMistake(fake({ explanation: "Kijk naar de regel.", rule: null, extraExamples: ["Ik ga."] }), {
      prompt: "p", correct: "c", explanation: "e", learnerAnswer: "x",
    });
    expect(explanation.rule).toBeNull();
  });

  it("generate: keeps valid exercises and drops broken ones", async () => {
    const gw = fake({
      exercises: [
        { prompt: "Goed?", options: ["a", "b", "c"], answer: 1, explanation: "Omdat." },
        { prompt: "Fout index", options: ["a", "b"], answer: 5, explanation: "Nee." },
        { prompt: "Dubbel", options: ["a", "a"], answer: 0, explanation: "Nee." },
      ],
    });
    const res = await generateExercises(gw, { unitId: "u", type: "mc", count: 5 }, { unit: null, topic: "Wonen", tags: ["knm:wonen"], words: [], examples: [], facts: "- feit" }, (n) => `gen-u-1-${n}`);
    expect(res.exercises).toHaveLength(1);
    expect(res.dropped).toBe(2);
    expect(res.exercises[0]).toMatchObject({ id: "gen-u-1-1", type: "mc", tags: ["knm:wonen"] });
    expect(gw.calls[0].user).toContain("Verzin geen feiten, bedragen of datums");
  });

  it("generate: drops gap-fill with a wrong number of gaps", async () => {
    const gw = fake({ exercises: [{ prompt: "p", text: "Ik ___ naar ___ .", answers: [["ga"]], explanation: "e" }] });
    const res = await generateExercises(gw, { unitId: "u", type: "gap-fill", count: 5 }, { unit: null, topic: "t", tags: [], words: [], examples: [] }, (n) => `g${n}`);
    expect(res.exercises).toHaveLength(0);
  });
});

describe("describeAnswer / describeCorrect", () => {
  const mc = { id: "m", type: "mc", tags: [], prompt: "p", explanation: "e", difficulty: 1, options: ["a", "b", "c"], answer: 2 } as Exercise;
  it("turns indexes into option text", () => {
    expect(describeAnswer(mc, 0)).toBe("a");
    expect(describeCorrect(mc)).toBe("c");
  });
  it("describes word order and conjugation", () => {
    const wo = { id: "w", type: "word-order", tags: [], prompt: "p", explanation: "e", difficulty: 1, tokens: ["Ik", "ga"] } as Exercise;
    expect(describeAnswer(wo, ["ga", "Ik"])).toBe("ga Ik");
    expect(describeCorrect(wo)).toBe("Ik ga");
    const cj = { id: "c", type: "conjugate", tags: [], prompt: "p", explanation: "e", difficulty: 1, verbId: "v", person: "ik", tense: "perfect", answers: ["gewerkt"] } as Exercise;
    expect(describeAnswer(cj, { form: "gewerkt", aux: "zijn" })).toBe("zijn gewerkt");
  });
});
