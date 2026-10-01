import { Router } from "express";
import { z } from "zod";
import { dayString, newCard, pickDueCards, reviewCard, isLearned } from "../../shared/logic/srs.js";
import type { SrsCard, VocabEntry, VerbEntry } from "../../shared/types.js";
import { getContent } from "../db/contentRepo.js";
import { loadSettings, loadSrs, saveSrs } from "../db/progressRepo.js";

export const srsRouter = Router();

function cardsFor(refId: string, vocab: VocabEntry | undefined, verb: VerbEntry | undefined, today: string): SrsCard[] {
  if (vocab) {
    const cards = [newCard(refId, "meaning", today), newCard(refId, "recognise", today)];
    if (vocab.pos === "noun" && vocab.article) cards.push(newCard(refId, "article", today));
    return cards;
  }
  if (verb) return [newCard(refId, "verb-forms", today)];
  return [];
}

/** Create SRS cards for the given vocab/verb ids (existing cards are kept). Returns how many were new. */
export async function introduceCards(refIds: string[]): Promise<number> {
  const content = await getContent();
  const srs = await loadSrs();
  const today = dayString(new Date());
  let added = 0;
  for (const refId of refIds) {
    for (const card of cardsFor(refId, content.vocabById.get(refId), content.verbs.get(refId), today)) {
      if (srs.cards[card.id]) continue;
      srs.cards[card.id] = card;
      added++;
    }
  }
  if (added > 0) await saveSrs(srs);
  return added;
}

const shuffle = <T>(arr: T[]): T[] => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

srsRouter.get("/srs/due", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 30), 100);
  const kind = req.query.kind === "verb" ? "verb" : req.query.kind === "vocab" ? "vocab" : "all";
  const content = await getContent();
  const settings = await loadSettings();
  const srs = await loadSrs();
  const today = dayString(new Date());

  const eligible = Object.values(srs.cards).filter((c) => {
    const isVerb = c.cardType === "verb-forms";
    return kind === "all" || (kind === "verb") === isVerb;
  });
  const usedToday = srs.newToday.day === today ? srs.newToday.count : 0;
  const due = pickDueCards(eligible, today, { limit, newAllowance: settings.newCardsPerDay - usedToday });

  const allDefs = [...content.vocabById.values()];
  const cards = due.flatMap((card) => {
    const vocab = content.vocabById.get(card.refId);
    const verb = content.verbs.get(card.refId);
    if (!vocab && !verb) return [];
    const distractors = vocab
      ? shuffle(allDefs.filter((e) => e.id !== vocab.id)).slice(0, 3).map((e) => e.definitionNl)
      : [];
    return [{ card, vocab: vocab ?? null, verb: verb ?? null, distractors }];
  });
  res.json(cards);
});

const ReviewSchema = z.object({ cardId: z.string(), grade: z.enum(["opnieuw", "moeilijk", "goed", "makkelijk"]) });

srsRouter.post("/srs/review", async (req, res) => {
  const parsed = ReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_body", message: "De beoordeling kon niet worden opgeslagen." } });
    return;
  }
  const srs = await loadSrs();
  const card = srs.cards[parsed.data.cardId];
  if (!card) {
    res.status(404).json({ error: { code: "not_found", message: "Dit woordkaartje bestaat niet." } });
    return;
  }
  const now = new Date();
  const today = dayString(now);
  if (card.reps === 0) {
    const used = srs.newToday.day === today ? srs.newToday.count : 0;
    srs.newToday = { day: today, count: used + 1 };
  }
  srs.cards[card.id] = reviewCard(card, parsed.data.grade, today, now.toISOString());
  await saveSrs(srs);
  res.json(srs.cards[card.id]);
});

const IntroduceSchema = z.object({ theme: z.string().optional(), verbs: z.boolean().optional() });

srsRouter.post("/srs/introduce", async (req, res) => {
  const parsed = IntroduceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: { code: "invalid_body", message: "Dit thema kon niet worden geleerd." } });
    return;
  }
  const content = await getContent();
  const ids: string[] = [];
  if (parsed.data.theme) ids.push(...(content.vocabByTheme.get(parsed.data.theme)?.entries.map((e) => e.id) ?? []));
  if (parsed.data.verbs) ids.push(...content.verbs.keys());
  res.json({ added: await introduceCards(ids) });
});

srsRouter.get("/vocab", async (_req, res) => {
  const content = await getContent();
  const srs = await loadSrs();
  const cardsByRef = new Map<string, SrsCard[]>();
  for (const c of Object.values(srs.cards)) cardsByRef.set(c.refId, [...(cardsByRef.get(c.refId) ?? []), c]);
  const stateOf = (id: string): "new" | "learning" | "learned" => {
    const cards = cardsByRef.get(id);
    if (!cards) return "new";
    return cards.every(isLearned) ? "learned" : "learning";
  };
  res.json(
    [...content.vocabByTheme.values()].map((file) => ({
      theme: file.theme,
      title: file.title,
      entries: file.entries.map((e) => ({ ...e, state: stateOf(e.id) })),
    })),
  );
});

srsRouter.get("/verbs", async (_req, res) => {
  const content = await getContent();
  const srs = await loadSrs();
  res.json(
    [...content.verbs.values()].map((v) => {
      const card = srs.cards[`${v.id}:verb-forms`];
      return { ...v, state: !card ? "new" : isLearned(card) ? "learned" : "learning" };
    }),
  );
});
