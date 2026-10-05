import type { Exercise } from "../types.js";

/** Readable version of the learner's answer, for the "explain" prompt and the cache key. */
export function describeAnswer(ex: Exercise, answer: unknown): string {
  switch (ex.type) {
    case "mc":
      return typeof answer === "number" ? (ex.options[answer] ?? String(answer)) : String(answer);
    case "mc-multi":
      return Array.isArray(answer) ? answer.map((i) => ex.options[i as number] ?? String(i)).join(" + ") : String(answer);
    case "true-false":
      return answer === true ? "Klopt" : answer === false ? "Klopt niet" : String(answer);
    case "gap-fill":
    case "gap-choice":
      return Array.isArray(answer) ? answer.map(String).join(", ") : String(answer);
    case "word-order":
      return Array.isArray(answer) ? answer.map(String).join(" ") : String(answer);
    case "conjugate": {
      const a = answer as { form?: string; aux?: string } | null;
      return a && typeof a === "object" ? `${a.aux ? a.aux + " " : ""}${a.form ?? ""}`.trim() : String(answer);
    }
    default:
      return typeof answer === "string" ? answer : JSON.stringify(answer);
  }
}

/** The correct answer as text (for exercises that have one). */
export function describeCorrect(ex: Exercise): string {
  switch (ex.type) {
    case "mc":
      return ex.options[ex.answer];
    case "mc-multi":
      return ex.answers.map((i) => ex.options[i]).join(" + ");
    case "true-false":
      return ex.answer ? "Klopt" : "Klopt niet";
    case "gap-fill":
      return ex.answers.map((a) => a[0]).join(", ");
    case "gap-choice":
      return ex.answers.map((a, i) => ex.options[i][a]).join(", ");
    case "word-order":
      return ex.tokens.join(" ");
    case "conjugate":
      return ex.answers[0];
    case "match":
      return ex.pairs.map(([l, r]) => `${l} = ${r}`).join("; ");
    default:
      return ex.explanation;
  }
}

export function optionsOf(ex: Exercise): string[] | undefined {
  return ex.type === "mc" || ex.type === "mc-multi" ? ex.options : undefined;
}
