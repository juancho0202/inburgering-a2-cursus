import { buildExerciseIndex, examTagIndex } from "../content/exerciseIndex.js";
import { practiceTagFor } from "../logic/corrections.js";
import { hardItemIds, weakestTags } from "../logic/weakspots.js";
import { getLastLocation, derivedStats } from "./progress.js";
import { getSettings } from "./settings.js";
import { today, type Env } from "./context.js";
import { backupReminder } from "./transfer.js";

export async function dashboard(env: Env) {
  const day = today(env);
  const [stats, units, cards, exams, settings, lastLoc, generated] = await Promise.all([
    derivedStats(env),
    env.store.units.all(),
    env.store.srsCards.all(),
    env.store.examResults.all(),
    getSettings(env),
    getLastLocation(env),
    env.store.generated.all(),
  ]);
  const index = buildExerciseIndex(env.content, generated);
  const examTags = examTagIndex(env.content);
  const completed = new Set(units.filter((u) => u.status === "completed").map((u) => u.id));

  const modules = [...env.content.modules.values()].map((mod) => ({
    id: mod.id,
    title: mod.title,
    icon: mod.icon,
    total: mod.units.length,
    completed: mod.units.filter((id) => completed.has(id)).length,
  }));

  // Where "Begin met leren" goes: the first lesson (in course order) that is not completed yet.
  const nextUnitId =
    [...env.content.modules.values()].flatMap((m) => m.units).find((id) => !completed.has(id)) ??
    [...env.content.modules.values()].flatMap((m) => m.units)[0] ??
    null;
  const lastUnit = lastLoc ? env.content.units.get(lastLoc.unitId) : undefined;
  const nextExam = [...env.content.exams.values()].find((e) => !exams.some((r) => r.examId === e.id && r.finishedAt));

  return {
    lastLocation:
      lastLoc && lastUnit ? { unitId: lastUnit.id, unitTitle: lastUnit.title, stepIndex: lastLoc.stepIndex, stepCount: lastUnit.steps.length } : null,
    nextUnitId,
    dailyGoalMinutes: settings.dailyGoalMinutes,
    minutesToday: Math.round((stats.minutes[day] ?? 0) * 10) / 10,
    streak: stats.streak,
    dueCount: cards.filter((c) => c.reps > 0 && c.due <= day).length,
    newCount: cards.filter((c) => c.reps === 0).length,
    modules,
    // Only items we can actually practise again (exam questions and writing checks cannot be).
    hardCount: hardItemIds(stats.items).filter((id) => !id.startsWith("writing:") && index.resolve(id)).length,
    // Writing error types (writing:woordvolgorde, ...) are tags of their own.
    weakTags: weakestTags(stats.items, (id) => (id.startsWith("writing:") ? [id] : (index.resolve(id)?.tags ?? examTags.get(id) ?? []))),
    backupReminder: await backupReminder(env),
    nextExam: nextExam ? { id: nextExam.id, title: nextExam.title, skill: nextExam.skill, durationMinutes: nextExam.durationMinutes } : null,
  };
}

/** Mixed practice session: hardest items, items with a tag, or the Claude-made items of a unit. */
export async function practice(env: Env, query: { tag?: string; unit?: string; generated?: string; limit?: number }) {
  const generated = await env.store.generated.all();
  const index = buildExerciseIndex(env.content, generated);
  const { items } = await derivedStats(env);
  const tag = query.tag?.startsWith("writing:") ? practiceTagFor(query.tag) : query.tag;
  const limit = Math.min(query.limit ?? 12, 30);
  const accuracy = (id: string) => (items[id] && items[id].seen > 0 ? items[id].correct / items[id].seen : 0.5);

  let ids: string[];
  if (query.generated) {
    ids = generated
      .filter((g) => g.unitId === query.generated && !g.hidden)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit)
      .map((g) => g.exercise.id);
  } else if (tag) {
    ids = [...index.byId.values()].filter((r) => r.tags.includes(tag)).map((r) => r.exercise.id);
    ids.sort((a, b) => accuracy(a) - accuracy(b));
  } else {
    ids = hardItemIds(items)
      .map((id) => index.resolve(id)?.exercise.id)
      .filter((id): id is string => !!id && (!query.unit || index.byId.get(id)?.unitId === query.unit));
  }
  return [...new Set(ids)].slice(0, limit).map((id) => index.byId.get(id)!.exercise);
}
