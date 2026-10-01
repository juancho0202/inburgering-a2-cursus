import type { ItemProgress } from "../types.js";

export interface TagStat {
  tag: string;
  seen: number;
  correct: number;
  accuracy: number;
}

const MIN_SEEN_FOR_TAG = 3;

/** Items wrong at least twice and wrong last time. */
export function hardItemIds(items: Record<string, ItemProgress>): string[] {
  return Object.entries(items)
    .filter(([, p]) => p.seen - p.correct >= 2 && p.lastCorrect === false)
    .map(([id]) => id);
}

/** Weakest tags (lowest accuracy), ignoring tags with too few attempts. */
export function weakestTags(items: Record<string, ItemProgress>, tagsOf: (id: string) => string[], count = 3): TagStat[] {
  const byTag = new Map<string, { seen: number; correct: number }>();
  for (const [id, p] of Object.entries(items)) {
    for (const tag of tagsOf(id)) {
      const t = byTag.get(tag) ?? { seen: 0, correct: 0 };
      t.seen += p.seen;
      t.correct += p.correct;
      byTag.set(tag, t);
    }
  }
  return [...byTag.entries()]
    .filter(([, t]) => t.seen >= MIN_SEEN_FOR_TAG)
    .map(([tag, t]) => ({ tag, ...t, accuracy: t.correct / t.seen }))
    .filter((t) => t.accuracy < 0.85)
    .sort((a, b) => a.accuracy - b.accuracy || b.seen - a.seen)
    .slice(0, count);
}
