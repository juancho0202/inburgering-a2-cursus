import { z } from "zod";
import { CORRECTION_TYPES, GenerateRequestSchema, type WritingFeedback } from "../schemas/claude.js";
import { describeAnswer, describeCorrect, optionsOf } from "../claude/describe.js";
import { mapClaudeError } from "../claude/errors.js";
import { NoApiKeyError, type ClaudeGateway } from "../claude/gateway.js";
import { explainMistake, generateExercises, writingFeedback } from "../claude/services.js";
import { normalizeAnswer } from "../logic/answers.js";
import { writingTag } from "../logic/corrections.js";
import type { GeneratedRecord } from "../schemas/store.js";
import { invalid, newId, nowIso, notFound, ServiceError, type Env } from "./context.js";
import { findExercise, findWritingExercise } from "./lookup.js";
import { addAttempt } from "./progress.js";
import { recordUsage } from "./settings.js";
import { summarizeWriting } from "./exams.js";

function gatewayOrThrow(env: Env): ClaudeGateway {
  if (!env.gateway) throw new NoApiKeyError();
  return env.gateway();
}

/** Turns any failure while talking to Claude into a ServiceError with a Dutch message. */
function claudeFailure(err: unknown, extra: Record<string, unknown> = {}): ServiceError {
  if (err instanceof ServiceError) return err;
  if (err instanceof NoApiKeyError) return new ServiceError(503, "no_api_key", "Voeg een API-sleutel toe bij Instellingen om deze functie te gebruiken.", extra);
  if (err instanceof SyntaxError || err instanceof z.ZodError) return new ServiceError(502, "bad_answer", "Claude gaf een antwoord dat niet klopt. Probeer het opnieuw.", extra);
  return new ServiceError(502, "claude_error", mapClaudeError(err), extra);
}

// ---------- writing feedback (§10.2) ----------

const FeedbackBody = z.object({ exerciseId: z.string(), text: z.string().optional(), submissionId: z.string().optional(), examResultId: z.string().optional() });

/** Every writing check adds one attempt per error type, so "writing:woordvolgorde" can show up as a weak spot. */
async function recordWritingErrors(env: Env, feedback: WritingFeedback) {
  const present = new Set(feedback.corrections.map((c) => c.type));
  for (const type of CORRECTION_TYPES) {
    await addAttempt(env, { itemId: writingTag(type), exerciseType: "writing-check", correct: !present.has(type), durationMs: 0 });
  }
}

export async function feedbackWriting(env: Env, body: unknown) {
  const parsed = FeedbackBody.safeParse(body);
  if (!parsed.success) throw invalid("Er ontbreekt een tekst of opdracht.");
  const ex = await findWritingExercise(env, parsed.data.exerciseId);
  if (!ex) throw notFound("Deze schrijfopdracht bestaat niet.");

  // The learner's text is always saved BEFORE calling Claude, so nothing is lost.
  let submission = parsed.data.submissionId ? await env.store.writing.get(parsed.data.submissionId) : undefined;
  if (!submission) {
    if (!parsed.data.text?.trim()) throw invalid("Schrijf eerst een tekst.");
    submission = { id: `w-${newId(env)}`, exerciseId: ex.id, text: parsed.data.text, submittedAt: nowIso(env), feedback: null };
    await env.store.writing.put(submission);
  }
  const extra = { submissionId: submission.id };

  try {
    const { feedback, usage } = await writingFeedback(gatewayOrThrow(env), ex, submission.text);
    const saved = { ...submission, feedback };
    await env.store.writing.put(saved);
    await recordUsage(env, usage);
    await recordWritingErrors(env, feedback);
    if (parsed.data.examResultId) {
      // Part of a mock exam: the feedback score becomes the points for this task.
      const exam = await env.store.examResults.get(parsed.data.examResultId);
      if (exam) {
        exam.details[ex.id] = { kind: "writing", submissionId: submission.id, points: Math.min(10, Math.max(0, feedback.score)), max: 10 };
        summarizeWriting(exam);
        exam.updatedAt = nowIso(env);
        await env.store.examResults.put(exam);
      }
    }
    return { submission: saved, feedback };
  } catch (err) {
    throw claudeFailure(err, extra);
  }
}

// ---------- explain a mistake (§10.3) ----------

const ExplainBody = z.object({ itemId: z.string(), learnerAnswer: z.unknown() });

export async function explain(env: Env, body: unknown) {
  const parsed = ExplainBody.safeParse(body);
  if (!parsed.success) throw invalid("Er ontbreekt een vraag.");
  const ex = await findExercise(env, parsed.data.itemId);
  if (!ex) throw notFound("Deze vraag bestaat niet.");

  const learner = describeAnswer(ex, parsed.data.learnerAnswer);
  const key = `${ex.id}::${normalizeAnswer(learner)}`;
  const cached = await env.store.explanations.get(key);
  if (cached) return { explanation: cached.explanation, rule: cached.rule, extraExamples: cached.extraExamples, cached: true };

  try {
    const { explanation, usage } = await explainMistake(gatewayOrThrow(env), {
      prompt: ex.prompt,
      context: ex.context,
      correct: describeCorrect(ex),
      options: optionsOf(ex),
      explanation: ex.explanation,
      learnerAnswer: learner,
    });
    await env.store.explanations.put({ id: key, ...explanation, createdAt: nowIso(env) });
    await recordUsage(env, usage);
    return { ...explanation, cached: false };
  } catch (err) {
    throw claudeFailure(err);
  }
}

// ---------- generate extra practice (§10.4) ----------

export async function generate(env: Env, body: unknown) {
  const parsed = GenerateRequestSchema.safeParse(body);
  if (!parsed.success) throw invalid("Kies een les of onderwerp en een aantal van 5 tot 10.");
  const request = parsed.data;

  const unit = request.unitId
    ? env.content.units.get(request.unitId)
    : [...env.content.units.values()].find((u) => u.tags.includes(request.tag!) || u.steps.some((s) => s.type === "exercise" && s.exercise.tags.includes(request.tag!)));
  if (!unit) throw notFound("Deze les of dit onderwerp bestaat niet.");

  const unitExercises = unit.steps.flatMap((s) => (s.type === "exercise" ? [s.exercise] : []));
  const sameType = unitExercises.filter((e) => e.type === request.type);
  const examples = (sameType.length >= 3 ? sameType : [...sameType, ...unitExercises.filter((e) => e.type === "mc")]).slice(0, 3);
  const words = unit.vocabRefs.flatMap((id) => env.content.vocabById.get(id)?.nl ?? env.content.verbs.get(id)?.infinitive ?? []).slice(0, 40);
  const tags = [...new Set([...unit.tags, ...(request.tag ? [request.tag] : [])])];
  const stamp = Date.now();
  const facts = unit.moduleId === "knm" ? knmFacts(env, unit.id) : undefined;

  try {
    const { exercises, dropped, usage } = await generateExercises(
      gatewayOrThrow(env),
      request,
      { unit, topic: request.tag ?? unit.title, tags, words, examples, facts },
      (n) => `gen-${unit.id}-${stamp}-${n}`,
    );
    await recordUsage(env, usage);
    if (exercises.length === 0) throw new ServiceError(502, "bad_answer", "Claude maakte geen goede oefeningen. Probeer het opnieuw.");
    const createdAt = nowIso(env);
    const records: GeneratedRecord[] = exercises.map((exercise) => ({ id: exercise.id, unitId: unit.id, exercise, hidden: false, createdAt, updatedAt: createdAt }));
    await env.store.generated.putMany(records);
    return { unitId: unit.id, exercises, dropped };
  } catch (err) {
    throw claudeFailure(err);
  }
}

function knmFacts(env: Env, unitId: string): string | undefined {
  if (unitId === "knm-gemengd") return [...env.content.facts.values()].join("\n");
  return env.content.facts.get(unitId);
}

/** "Klopt niet": hide a generated exercise. */
export async function flagGenerated(env: Env, id: string): Promise<{ ok: true }> {
  const record = await env.store.generated.get(id);
  if (!record) throw notFound("Deze oefening bestaat niet.");
  await env.store.generated.put({ ...record, hidden: true, updatedAt: nowIso(env) });
  return { ok: true };
}
