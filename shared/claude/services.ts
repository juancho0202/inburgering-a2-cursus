import { z } from "zod";
import type { Exercise, Unit } from "../types.js";
import {
  ExplanationSchema,
  TaalcafeTurnSchema,
  WritingFeedbackSchema,
  type Explanation,
  type GenerateRequest,
  type TaalcafeTurn,
  type WritingFeedback,
} from "../schemas/claude.js";
import { ExerciseSchema } from "../schemas/content.js";
import { countWords } from "../logic/answers.js";
import { ClaudeRefusalError, type ClaudeGateway, type CompleteArgs } from "./gateway.js";
import {
  EXPLAIN_SYSTEM,
  GENERATE_SYSTEM,
  TAALCAFE_SITUATION_SYSTEM,
  TAALCAFE_SYSTEM,
  WRITING_FEEDBACK_SYSTEM,
  explainUser,
  generateUser,
  taalcafeSituationUser,
  taalcafeUser,
  writingFeedbackUser,
} from "./prompts.js";
import type { TaalcafeSituation } from "../logic/taalcafeSituations.js";
import { explanationJsonSchema, generateJsonSchemas, taalcafeJsonSchema, taalcafeSituationJsonSchema, writingFeedbackJsonSchema } from "./schemas.js";

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * Asks Claude for JSON and validates it. An answer that was cut off (stop_reason "max_tokens", e.g. after long
 * thinking) or that does not parse is asked for once more, with twice the room after a cut-off: the learner should
 * almost never see "Claude gaf een antwoord dat niet klopt". A refusal is not asked again.
 */
export async function completeJson<T>(gateway: ClaudeGateway, args: CompleteArgs, parse: (v: unknown) => T): Promise<{ value: T; usage: Usage }> {
  const usage: Usage = { inputTokens: 0, outputTokens: 0 };
  let maxTokens = args.maxTokens;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await gateway.complete({ ...args, maxTokens });
    usage.inputTokens += res.usage.inputTokens;
    usage.outputTokens += res.usage.outputTokens;
    if (res.stopReason === "refusal") throw new ClaudeRefusalError();
    try {
      return { value: parse(JSON.parse(res.text)), usage };
    } catch (err) {
      lastError = err;
    }
    if (res.stopReason === "max_tokens") maxTokens *= 2;
  }
  throw lastError;
}

export async function writingFeedback(
  gateway: ClaudeGateway,
  ex: Extract<Exercise, { type: "writing" }>,
  text: string,
): Promise<{ feedback: WritingFeedback; usage: Usage }> {
  const { value, usage } = await completeJson(
    gateway,
    {
      system: WRITING_FEEDBACK_SYSTEM,
      user: writingFeedbackUser(ex, text, countWords(text)),
      schema: writingFeedbackJsonSchema as unknown as Record<string, unknown>,
      maxTokens: 8000,
      effort: "medium",
    },
    (v) => WritingFeedbackSchema.parse(v),
  );
  return { feedback: value, usage };
}

/** Sanne's reply is what the learner waits for: one malformed correction is left out instead of failing the turn. */
function parseTaalcafeTurn(v: unknown): TaalcafeTurn {
  const raw = TaalcafeTurnSchema.extend({ corrections: z.array(z.unknown()) }).parse(v);
  const corrections = raw.corrections.flatMap((c) => {
    const ok = TaalcafeTurnSchema.shape.corrections.element.safeParse(c);
    return ok.success ? [ok.data] : [];
  });
  return { reply: raw.reply, corrections };
}

export async function taalcafeTurn(
  gateway: ClaudeGateway,
  args: { topic: string; words?: string[]; history: { from: "partner" | "learner"; text: string }[]; message: string },
): Promise<{ turn: TaalcafeTurn; usage: Usage }> {
  const { value, usage } = await completeJson(
    gateway,
    {
      system: TAALCAFE_SYSTEM,
      user: taalcafeUser(args.topic, args.history, args.message, args.words ?? []),
      schema: taalcafeJsonSchema as unknown as Record<string, unknown>,
      maxTokens: 4000,
      // Small talk needs little thinking: a quick, steady answer.
      effort: "low",
    },
    parseTaalcafeTurn,
  );
  return { turn: value, usage };
}

/** One turn of a situation: Claude plays the role and says which of the learner's goals are reached so far. */
export async function taalcafeSituationTurn(
  gateway: ClaudeGateway,
  args: { situation: TaalcafeSituation; reached: string[]; history: { from: "partner" | "learner"; text: string }[]; message: string },
): Promise<{ turn: TaalcafeTurn & { goalsReached: string[] }; usage: Usage }> {
  const goalIds = args.situation.goals.map((g) => g.id);
  const { value, usage } = await completeJson(
    gateway,
    {
      system: TAALCAFE_SITUATION_SYSTEM,
      user: taalcafeSituationUser(args.situation, args.reached, args.history, args.message),
      schema: taalcafeSituationJsonSchema(goalIds) as unknown as Record<string, unknown>,
      maxTokens: 4000,
      effort: "low",
    },
    (v) => {
      const turn = parseTaalcafeTurn(v);
      const reached = z.object({ goalsReached: z.array(z.unknown()).default([]) }).parse(v).goalsReached;
      return { ...turn, goalsReached: reached.filter((g): g is string => typeof g === "string") };
    },
  );
  return { turn: value, usage };
}

export async function explainMistake(
  gateway: ClaudeGateway,
  args: Parameters<typeof explainUser>[0],
): Promise<{ explanation: Explanation; usage: Usage }> {
  const { value, usage } = await completeJson(
    gateway,
    { system: EXPLAIN_SYSTEM, user: explainUser(args), schema: explanationJsonSchema as unknown as Record<string, unknown>, maxTokens: 4000, effort: "low" },
    (v) => ExplanationSchema.parse(v),
  );
  return { explanation: value, usage };
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
  const { value: raw, usage } = await completeJson(
    gateway,
    {
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
      maxTokens: 12000,
      effort: "medium",
    },
    (v) => z.object({ exercises: z.array(z.any()) }).parse(v).exercises,
  );
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
  return { exercises, dropped, usage };
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
