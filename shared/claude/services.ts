import type { Exercise, Unit } from "../types.js";
import {
  ExplanationSchema,
  WritingFeedbackSchema,
  type Explanation,
  type GenerateRequest,
  type WritingFeedback,
} from "../schemas/claude.js";
import { ExerciseSchema } from "../schemas/content.js";
import { countWords } from "../logic/answers.js";
import type { ClaudeGateway } from "./gateway.js";
import { EXPLAIN_SYSTEM, GENERATE_SYSTEM, WRITING_FEEDBACK_SYSTEM, explainUser, generateUser, writingFeedbackUser } from "./prompts.js";
import { explanationJsonSchema, generateJsonSchemas, writingFeedbackJsonSchema } from "./schemas.js";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

/** Parse JSON from the model and validate it. Throws if the shape is wrong. */
function parseJson<T>(text: string, parse: (v: unknown) => T): T {
  return parse(JSON.parse(text));
}

export async function writingFeedback(
  gateway: ClaudeGateway,
  ex: Extract<Exercise, { type: "writing" }>,
  text: string,
): Promise<{ feedback: WritingFeedback; usage: Usage }> {
  const res = await gateway.complete({
    system: WRITING_FEEDBACK_SYSTEM,
    user: writingFeedbackUser(ex, text, countWords(text)),
    schema: writingFeedbackJsonSchema as unknown as Record<string, unknown>,
    maxTokens: 2000,
  });
  const feedback = parseJson(res.text, (v) => WritingFeedbackSchema.parse(v));
  return { feedback, usage: res.usage };
}

export async function explainMistake(
  gateway: ClaudeGateway,
  args: Parameters<typeof explainUser>[0],
): Promise<{ explanation: Explanation; usage: Usage }> {
  const res = await gateway.complete({
    system: EXPLAIN_SYSTEM,
    user: explainUser(args),
    schema: explanationJsonSchema as unknown as Record<string, unknown>,
    maxTokens: 800,
  });
  return { explanation: parseJson(res.text, (v) => ExplanationSchema.parse(v)), usage: res.usage };
}

interface RawMc {
  prompt: string;
  options: string[];
  answer: number;
  explanation: string;
}

const mcFrom = (id: string, q: RawMc, tags: string[]) => ({
  id,
  type: "mc" as const,
  tags,
  prompt: q.prompt,
  options: q.options,
  answer: q.answer,
  explanation: q.explanation,
  difficulty: 1,
});

/**
 * Ask Claude for new exercises and keep only those that pass our own validation.
 * `ids` is called once per exercise (and per reading sub-question prefix).
 */
export async function generateExercises(
  gateway: ClaudeGateway,
  req: GenerateRequest,
  ctx: { unit: Unit | null; topic: string; tags: string[]; words: string[]; examples: Exercise[]; facts?: string },
  makeId: (n: number) => string,
): Promise<{ exercises: Exercise[]; dropped: number; usage: Usage }> {
  const res = await gateway.complete({
    system: GENERATE_SYSTEM,
    user: generateUser({
      type: req.type,
      count: req.count,
      goal: ctx.unit?.goal ?? ctx.topic,
      topic: ctx.topic,
      words: ctx.words,
      examples: ctx.examples,
      facts: ctx.facts,
    }),
    schema: generateJsonSchemas[req.type] as unknown as Record<string, unknown>,
    maxTokens: 4000,
  });
  const raw = (JSON.parse(res.text) as { exercises?: any[] }).exercises ?? [];
  const exercises: Exercise[] = [];
  let dropped = 0;
  raw.forEach((r, i) => {
    const id = makeId(i + 1);
    let candidate: unknown;
    if (req.type === "mc") candidate = mcFrom(id, r, ctx.tags);
    else if (req.type === "gap-fill")
      candidate = { id, type: "gap-fill", tags: ctx.tags, prompt: r.prompt, text: r.text, answers: r.answers, explanation: r.explanation, difficulty: 1 };
    else if (req.type === "word-order")
      candidate = { id, type: "word-order", tags: ctx.tags, prompt: r.prompt, tokens: r.tokens, explanation: r.explanation, difficulty: 1 };
    else
      candidate = {
        id,
        type: "reading",
        tags: ctx.tags,
        prompt: r.prompt,
        document: { kind: "document", docType: r.docType, title: r.title, body: r.body },
        questions: (r.questions ?? []).map((q: RawMc, qi: number) => mcFrom(`${id}-${qi + 1}`, q, ctx.tags)),
        explanation: r.explanation,
        difficulty: 1,
      };
    const parsed = ExerciseSchema.safeParse(candidate);
    if (parsed.success && sensible(parsed.data)) exercises.push(parsed.data);
    else dropped++;
  });
  return { exercises, dropped, usage: res.usage };
}

/** Extra checks on top of the schema, so a bad model answer never reaches the learner. */
function sensible(ex: Exercise): boolean {
  switch (ex.type) {
    case "mc":
      return ex.answer >= 0 && ex.answer < ex.options.length && new Set(ex.options).size === ex.options.length;
    case "gap-fill":
      return ex.text.split("___").length - 1 === ex.answers.length && ex.answers.every((a) => a.length > 0);
    case "word-order":
      return ex.tokens.length >= 3;
    case "reading":
      return ex.questions.length >= 1 && ex.questions.every(sensible);
    default:
      return true;
  }
}
