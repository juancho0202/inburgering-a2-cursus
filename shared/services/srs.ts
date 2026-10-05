import { z } from "zod";
import { isLearned, newCard, pickDueCards, reviewCard, type Grade } from "../logic/srs.js";
import { KV, type NewToday, type SrsCardRecord } from "../schemas/store.js";
import type { VerbEntry, VocabEntry } from "../types.js";
import { invalid, notFound, nowIso, random, today, type Env } from "./context.js";
import { getSettings } from "./settings.js";

function cardsFor(refId: string, vocab: VocabEntry | undefined, verb: VerbEntry | undefined, day: string) {
  if (vocab) {
    const cards = [newCard(refId, "meaning", day), newCard(refId, "recognise", day)];
    if (vocab.pos === "noun" && vocab.article) cards.push(newCard(refId, "article", day));
    return cards;
  }
  if (verb) return [newCard(refId, "verb-forms", day)];
  return [];
}

/** Create SRS cards for vocab/verb ids (existing cards are kept). Returns how many were new. */
export async function introduceCards(env: Env, refIds: string[]): Promise<number> {
  const existing = new Set((await env.store.srsCards.all()).map((c) => c.id));
  const stamp = nowIso(env);
  const fresh: SrsCardRecord[] = [];
  for (const refId of refIds) {
    for (const card of cardsFor(refId, env.content.vocabById.get(refId), env.content.verbs.get(refId), today(env))) {
      if (existing.has(card.id)) continue;
      existing.add(card.id);
      fresh.push({ ...card, updatedAt: stamp });
    }
  }
  await env.store.srsCards.putMany(fresh);
  return fresh.length;
}

function shuffle<T>(env: Env, arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random(env) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function dueCards(env: Env, query: { kind?: string; limit?: number }) {
  const limit = Math.min(query.limit ?? 30, 100);
  const kind = query.kind === "verb" ? "verb" : query.kind === "vocab" ? "vocab" : "all";
  const day = today(env);
  const settings = await getSettings(env);
  const newToday = await env.store.kv.get<NewToday>(KV.srsNewToday);

  const eligible = (await env.store.srsCards.all()).filter((c) => kind === "all" || (kind === "verb") === (c.cardType === "verb-forms"));
  const usedToday = newToday?.day === day ? newToday.count : 0;
  const due = pickDueCards(eligible, day, { limit, newAllowance: settings.newCardsPerDay - usedToday });

  const allDefs = [...env.content.vocabById.values()];
  return due.flatMap((card) => {
    const vocab = env.content.vocabById.get(card.refId);
    const verb = env.content.verbs.get(card.refId);
    if (!vocab && !verb) return [];
    const distractors = vocab
      ? shuffle(env, allDefs.filter((e) => e.id !== vocab.id))
          .slice(0, 3)
          .map((e) => e.definitionNl)
      : [];
    return [{ card, vocab: vocab ?? null, verb: verb ?? null, distractors }];
  });
}

const ReviewSchema = z.object({ cardId: z.string(), grade: z.enum(["opnieuw", "moeilijk", "goed", "makkelijk"]) });

export async function reviewSrsCard(env: Env, body: unknown): Promise<SrsCardRecord> {
  const parsed = ReviewSchema.safeParse(body);
  if (!parsed.success) throw invalid("De beoordeling kon niet worden opgeslagen.");
  const card = await env.store.srsCards.get(parsed.data.cardId);
  if (!card) throw notFound("Dit woordkaartje bestaat niet.");
  const day = today(env);
  if (card.reps === 0) {
    const newToday = await env.store.kv.get<NewToday>(KV.srsNewToday);
    const used = newToday?.day === day ? newToday.count : 0;
    await env.store.kv.set(KV.srsNewToday, { day, count: used + 1 } satisfies NewToday);
  }
  const updated: SrsCardRecord = { ...reviewCard(card, parsed.data.grade as Grade, day, nowIso(env)), updatedAt: nowIso(env) };
  await env.store.srsCards.put(updated);
  return updated;
}

const IntroduceSchema = z.object({ theme: z.string().optional(), verbs: z.boolean().optional() });

export async function introduce(env: Env, body: unknown): Promise<{ added: number }> {
  const parsed = IntroduceSchema.safeParse(body);
  if (!parsed.success) throw invalid("Dit thema kon niet worden geleerd.");
  const ids: string[] = [];
  if (parsed.data.theme) ids.push(...(env.content.vocabByTheme.get(parsed.data.theme)?.entries.map((e) => e.id) ?? []));
  if (parsed.data.verbs) ids.push(...env.content.verbs.keys());
  return { added: await introduceCards(env, ids) };
}

type WordState = "new" | "learning" | "learned";

export async function vocabList(env: Env) {
  const byRef = new Map<string, SrsCardRecord[]>();
  for (const c of await env.store.srsCards.all()) byRef.set(c.refId, [...(byRef.get(c.refId) ?? []), c]);
  const stateOf = (id: string): WordState => {
    const cards = byRef.get(id);
    return !cards ? "new" : cards.every(isLearned) ? "learned" : "learning";
  };
  return [...env.content.vocabByTheme.values()].map((file) => ({
    theme: file.theme,
    title: file.title,
    entries: file.entries.map((e) => ({ ...e, state: stateOf(e.id) })),
  }));
}

export async function verbList(env: Env) {
  const cards = new Map((await env.store.srsCards.all()).map((c) => [c.id, c]));
  return [...env.content.verbs.values()].map((v) => {
    const card = cards.get(`${v.id}:verb-forms`);
    const state: WordState = !card ? "new" : isLearned(card) ? "learned" : "learning";
    return { ...v, state };
  });
}

