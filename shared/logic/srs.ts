import type { SrsCard } from "../types.js";

export type Grade = "opnieuw" | "moeilijk" | "goed" | "makkelijk";
export type CardType = SrsCard["cardType"];

export const BOX_INTERVAL_DAYS = [0, 1, 2, 4, 8, 16];
export const MAX_BOX = 5;
export const LEARNED_BOX = 4;

/** Local calendar day as YYYY-MM-DD. */
export function dayString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return dayString(new Date(y, m - 1, d + days));
}

export function isLearned(card: Pick<SrsCard, "box">): boolean {
  return card.box >= LEARNED_BOX;
}

export function newCard(refId: string, cardType: CardType, today: string): SrsCard {
  return { id: `${refId}:${cardType}`, refId, cardType, box: 0, due: today, reps: 0, lapses: 0, lastReviewedAt: null };
}

/** Pure Leitner scheduler. Returns a new card; does not mutate. */
export function reviewCard(card: SrsCard, grade: Grade, today: string, nowIso: string): SrsCard {
  let box = card.box;
  let due: string;
  let lapses = card.lapses;
  switch (grade) {
    case "opnieuw":
      box = 0;
      lapses += 1;
      due = today;
      break;
    case "moeilijk":
      due = addDays(today, 1);
      break;
    case "goed":
      box = Math.min(MAX_BOX, box + 1);
      due = addDays(today, BOX_INTERVAL_DAYS[box]);
      break;
    case "makkelijk":
      box = Math.min(MAX_BOX, box + 2);
      due = addDays(today, BOX_INTERVAL_DAYS[box]);
      break;
  }
  return { ...card, box, due, lapses, reps: card.reps + 1, lastReviewedAt: nowIso };
}

/**
 * Pick the cards for a session: all due reviews first, then new cards
 * up to the remaining daily allowance. `limit` caps the total.
 */
export function pickDueCards(
  cards: SrsCard[],
  today: string,
  opts: { limit: number; newAllowance: number },
): SrsCard[] {
  const reviews = cards.filter((c) => c.reps > 0 && c.due <= today).sort((a, b) => a.due.localeCompare(b.due));
  const fresh = cards.filter((c) => c.reps === 0 && c.due <= today).slice(0, Math.max(0, opts.newAllowance));
  return [...reviews, ...fresh].slice(0, opts.limit);
}
