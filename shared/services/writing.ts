import { z } from "zod";
import type { WritingRecord } from "../schemas/store.js";
import { invalid, newId, nowIso, type Env } from "./context.js";
import { findWritingExercise } from "./lookup.js";

/** All submissions (newest first) with the task they belong to, for the history screen. */
export async function listWriting(env: Env) {
  const all = (await env.store.writing.all()).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  return Promise.all(
    all.map(async (s) => {
      const ex = await findWritingExercise(env, s.exerciseId);
      const type = ex?.tags.find((t) => t.startsWith("schrijven:"))?.slice("schrijven:".length) ?? "overig";
      return {
        ...s,
        task: ex
          ? { prompt: ex.prompt, scenario: ex.task.scenario, register: ex.register, type, minWords: ex.minWords, maxWords: ex.maxWords }
          : null,
      };
    }),
  );
}

const NewSubmissionSchema = z.object({ exerciseId: z.string(), text: z.string() });

/** The learner's text is saved before anything else happens (before Claude is asked for feedback). */
export async function saveWriting(env: Env, body: unknown): Promise<WritingRecord> {
  const parsed = NewSubmissionSchema.safeParse(body);
  if (!parsed.success) throw invalid("De tekst kon niet worden opgeslagen.");
  const submission: WritingRecord = { id: `w-${newId(env)}`, exerciseId: parsed.data.exerciseId, text: parsed.data.text, submittedAt: nowIso(env), feedback: null };
  await env.store.writing.put(submission);
  return submission;
}
