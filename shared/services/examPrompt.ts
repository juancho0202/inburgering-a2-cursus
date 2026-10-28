import { daysBetween } from "../logic/studyPlan.js";
import { today, type Env } from "./context.js";
import { changeSettings, getSettings } from "./settings.js";

/** "Wanneer is je examen?" after a lesson or mock exam: at most this many times, this many days apart. */
export const EXAM_PROMPT_MAX = 3;
export const EXAM_PROMPT_GAP_DAYS = 3;

/**
 * Whether to show the exam date card now. When it is shown, that counts as one of the times.
 * Not before the learner has finished 2 lessons or a mock exam: the first lesson should just be a win.
 */
export async function claimExamPrompt(env: Env): Promise<{ show: boolean }> {
  const { examDates, examPrompt: p } = await getSettings(env);
  if (Object.keys(examDates).length || p.never || p.shown >= EXAM_PROMPT_MAX) return { show: false };
  if (p.lastShown && daysBetween(p.lastShown, today(env)) < EXAM_PROMPT_GAP_DAYS) return { show: false };
  const [units, exams] = await Promise.all([env.store.units.all(), env.store.examResults.all()]);
  const active = units.filter((u) => u.status === "completed").length >= 2 || exams.some((r) => r.finishedAt);
  if (!active) return { show: false };
  await changeSettings(env, (s) => ({ ...s, examPrompt: { ...s.examPrompt, shown: s.examPrompt.shown + 1, lastShown: today(env) } }));
  return { show: true };
}

/** "Niet meer vragen": the card is not shown again, and the dashboard stops asking too. */
export async function stopExamPrompt(env: Env): Promise<{ ok: true }> {
  await changeSettings(env, (s) => ({ ...s, examPrompt: { ...s.examPrompt, never: true } }));
  return { ok: true };
}
