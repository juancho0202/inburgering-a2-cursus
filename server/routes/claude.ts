import { Router, type Response } from "express";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CORRECTION_TYPES, GenerateRequestSchema } from "../../shared/schemas/claude.js";
import type { GeneratedItem, WritingFeedback } from "../../shared/schemas/claude.js";
import { normalizeAnswer } from "../../shared/logic/answers.js";
import { writingTag } from "../../shared/logic/corrections.js";
import type { Exercise, Settings } from "../../shared/types.js";
import {
  loadExplanations,
  loadProgress,
  loadSettings,
  loadWriting,
  recordUsage,
  saveExplanations,
  saveProgress,
  saveWritingSubmission,
  updateWritingSubmission,
} from "../db/progressRepo.js";
import { COURSE_DIR, buildExerciseIndex, getContent, reloadContent } from "../db/contentRepo.js";
import { writeJson, readJson } from "../db/fileStore.js";
import { GeneratedFileSchema } from "../../shared/schemas/claude.js";
import { summarizeWriting } from "./exams.js";
import { createGateway, NoApiKeyError, type ClaudeGateway } from "../claude/gateway.js";
import { mapClaudeError } from "../claude/client.js";
import { explainMistake, generateExercises, writingFeedback } from "../claude/services.js";
import { describeAnswer, describeCorrect, optionsOf } from "../claude/describe.js";

export const claudeRouter = Router();

/** Tests replace this with a fake gateway. */
let gatewayFactory: (settings: Settings) => ClaudeGateway = createGateway;
export function setGatewayFactory(f: (settings: Settings) => ClaudeGateway) {
  gatewayFactory = f;
}

const fail = (res: Response, status: number, code: string, message: string, extra: object = {}) =>
  res.status(status).json({ error: { code, message }, ...extra });

/** Maps any failure while talking to Claude to a Dutch message. */
function claudeFailure(res: Response, err: unknown, extra: object = {}) {
  if (err instanceof NoApiKeyError)
    return fail(res, 503, "no_api_key", "Voeg een API-sleutel toe bij Instellingen om deze functie te gebruiken.", extra);
  if (err instanceof SyntaxError || err instanceof z.ZodError)
    return fail(res, 502, "bad_answer", "Claude gaf een antwoord dat niet klopt. Probeer het opnieuw.", extra);
  console.warn("[claude]", (err as Error)?.message);
  return fail(res, 502, "claude_error", mapClaudeError(err), extra);
}

// ---------- writing feedback (§10.2) ----------

const FeedbackBody = z.object({ exerciseId: z.string(), text: z.string().optional(), submissionId: z.string().optional(), examResultId: z.string().optional() });

async function recordWritingErrors(feedback: WritingFeedback) {
  const progress = await loadProgress();
  const now = new Date().toISOString();
  const present = new Set(feedback.corrections.map((c) => c.type));
  for (const type of CORRECTION_TYPES) {
    const id = writingTag(type);
    const prev = progress.items[id] ?? { seen: 0, correct: 0, lastCorrect: null, lastSeenAt: null };
    const ok = !present.has(type);
    progress.items[id] = { seen: prev.seen + 1, correct: prev.correct + (ok ? 1 : 0), lastCorrect: ok, lastSeenAt: now };
  }
  await saveProgress(progress);
}

claudeRouter.post("/claude/feedback-writing", async (req, res) => {
  const body = FeedbackBody.safeParse(req.body);
  if (!body.success) return fail(res, 400, "invalid_body", "Er ontbreekt een tekst of opdracht.");

  const content = await getContent();
  const ex = buildExerciseIndex(content).byId.get(body.data.exerciseId)?.exercise;
  if (!ex || ex.type !== "writing") return fail(res, 404, "not_found", "Deze schrijfopdracht bestaat niet.");

  // The learner's text is always saved BEFORE calling Claude, so nothing is lost.
  let submission = body.data.submissionId ? (await loadWriting()).submissions.find((s) => s.id === body.data.submissionId) : undefined;
  if (!submission) {
    if (!body.data.text?.trim()) return fail(res, 400, "invalid_body", "Schrijf eerst een tekst.");
    submission = { id: `w-${Date.now()}`, exerciseId: ex.id, text: body.data.text, submittedAt: new Date().toISOString(), feedback: null };
    await saveWritingSubmission(submission);
  }
  const extra = { submissionId: submission.id };

  try {
    const gateway = gatewayFactory(await loadSettings());
    const { feedback, usage } = await writingFeedback(gateway, ex, submission.text);
    const saved = await updateWritingSubmission(submission.id, { feedback });
    await recordUsage(usage);
    await recordWritingErrors(feedback);
    if (body.data.examResultId) {
      // Part of a mock exam: the feedback score becomes the points for this task.
      const progress = await loadProgress();
      const exam = progress.exams.find((r) => r.id === body.data.examResultId);
      if (exam) {
        exam.details[ex.id] = { kind: "writing", submissionId: submission.id, points: Math.min(10, Math.max(0, feedback.score)), max: 10 };
        summarizeWriting(exam);
        await saveProgress(progress);
      }
    }
    res.json({ submission: saved, feedback });
  } catch (err) {
    claudeFailure(res, err, extra);
  }
});

// ---------- explain a mistake (§10.3) ----------

const ExplainBody = z.object({ itemId: z.string(), learnerAnswer: z.unknown() });

claudeRouter.post("/claude/explain", async (req, res) => {
  const body = ExplainBody.safeParse(req.body);
  if (!body.success) return fail(res, 400, "invalid_body", "Er ontbreekt een vraag.");

  const content = await getContent();
  const index = buildExerciseIndex(content);
  const parent = index.resolve(body.data.itemId)?.exercise;
  const ex: Exercise | undefined =
    parent && parent.type === "reading" && parent.id !== body.data.itemId ? parent.questions.find((q) => q.id === body.data.itemId) : parent;
  if (!ex) return fail(res, 404, "not_found", "Deze vraag bestaat niet.");

  const learner = describeAnswer(ex, body.data.learnerAnswer);
  const key = `${ex.id}::${normalizeAnswer(learner)}`;
  const cache = await loadExplanations();
  if (cache.entries[key]) return res.json({ ...cache.entries[key], cached: true });

  try {
    const gateway = gatewayFactory(await loadSettings());
    const { explanation, usage } = await explainMistake(gateway, {
      prompt: ex.prompt,
      context: ex.context,
      correct: describeCorrect(ex),
      options: optionsOf(ex),
      explanation: ex.explanation,
      learnerAnswer: learner,
    });
    const fresh = await loadExplanations();
    fresh.entries[key] = explanation;
    await saveExplanations(fresh);
    await recordUsage(usage);
    res.json({ ...explanation, cached: false });
  } catch (err) {
    claudeFailure(res, err);
  }
});

// ---------- generate extra practice (§10.4) ----------

const generatedPath = (unitId: string) => path.join(COURSE_DIR, "generated", `${unitId}.json`);

async function readFacts(unitId: string): Promise<string | undefined> {
  const dir = path.join(COURSE_DIR, "knm", "facts");
  try {
    if (unitId === "knm-gemengd") {
      const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".md"));
      return (await Promise.all(files.map((f) => fs.readFile(path.join(dir, f), "utf-8")))).join("\n");
    }
    return await fs.readFile(path.join(dir, `${unitId}.md`), "utf-8");
  } catch {
    return undefined;
  }
}

claudeRouter.post("/claude/generate", async (req, res) => {
  const body = GenerateRequestSchema.safeParse(req.body);
  if (!body.success) return fail(res, 400, "invalid_body", "Kies een les of onderwerp en een aantal van 5 tot 10.");
  const request = body.data;

  const content = await getContent();
  const unit = request.unitId
    ? content.units.get(request.unitId)
    : [...content.units.values()].find((u) => u.tags.includes(request.tag!) || u.steps.some((s) => s.type === "exercise" && s.exercise.tags.includes(request.tag!)));
  if (!unit) return fail(res, 404, "not_found", "Deze les of dit onderwerp bestaat niet.");

  const unitExercises = unit.steps.flatMap((s) => (s.type === "exercise" ? [s.exercise] : []));
  const sameType = unitExercises.filter((e) => e.type === request.type);
  const examples = (sameType.length >= 3 ? sameType : [...sameType, ...unitExercises.filter((e) => e.type === "mc")]).slice(0, 3);
  const words = unit.vocabRefs.flatMap((id) => content.vocabById.get(id)?.nl ?? content.verbs.get(id)?.infinitive ?? []).slice(0, 40);
  const tags = [...new Set([...unit.tags, ...(request.tag ? [request.tag] : [])])];
  const stamp = Date.now();

  try {
    const gateway = gatewayFactory(await loadSettings());
    const { exercises, dropped, usage } = await generateExercises(
      gateway,
      request,
      {
        unit,
        topic: request.tag ?? unit.title,
        tags,
        words,
        examples,
        facts: unit.moduleId === "knm" ? await readFacts(unit.id) : undefined,
      },
      (n) => `gen-${unit.id}-${stamp}-${n}`,
    );
    await recordUsage(usage);
    if (exercises.length === 0) return fail(res, 502, "bad_answer", "Claude maakte geen goede oefeningen. Probeer het opnieuw.");

    const file = await readJson(generatedPath(unit.id), GeneratedFileSchema, { unitId: unit.id, items: [] });
    const createdAt = new Date().toISOString();
    const items: GeneratedItem[] = exercises.map((exercise) => ({ exercise, source: "generated", hidden: false, createdAt }));
    file.items.push(...items);
    await writeJson(generatedPath(unit.id), file);
    await reloadContent();
    res.json({ unitId: unit.id, exercises, dropped });
  } catch (err) {
    claudeFailure(res, err);
  }
});

/** "Klopt niet": hide a generated exercise. */
claudeRouter.post("/generated/:id/flag", async (req, res) => {
  const content = await getContent();
  for (const [unitId, items] of content.generated) {
    const item = items.find((i) => i.exercise.id === req.params.id);
    if (!item) continue;
    item.hidden = true;
    await writeJson(generatedPath(unitId), { unitId, items });
    await reloadContent();
    return res.json({ ok: true });
  }
  fail(res, 404, "not_found", "Deze oefening bestaat niet.");
});
