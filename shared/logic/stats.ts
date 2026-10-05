import { addDays, dayString } from "./srs.js";
import type { ItemProgress } from "../types.js";

interface AttemptLike {
  itemId: string;
  correct: boolean;
  durationMs: number;
  at: string;
}

/** Per item: how often seen, how often right, and the result of the latest attempt. */
export function itemStats(attempts: AttemptLike[]): Record<string, ItemProgress> {
  const sorted = [...attempts].sort((a, b) => a.at.localeCompare(b.at));
  const out: Record<string, ItemProgress> = {};
  for (const a of sorted) {
    const s = (out[a.itemId] ??= { seen: 0, correct: 0, lastCorrect: null, lastSeenAt: null });
    s.seen++;
    if (a.correct) s.correct++;
    s.lastCorrect = a.correct;
    s.lastSeenAt = a.at;
  }
  return out;
}

/** Study minutes per local day. */
export function minutesByDay(attempts: AttemptLike[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const a of attempts) {
    const day = dayString(new Date(a.at));
    out[day] = (out[day] ?? 0) + a.durationMs / 60_000;
  }
  for (const day of Object.keys(out)) out[day] = Math.round(out[day] * 100) / 100;
  return out;
}

export interface Streak {
  current: number;
  best: number;
  lastDay: string | null;
}

/**
 * Day streak from the days with activity. `current` counts back from today (or yesterday, so the
 * streak is still alive until the end of today); `best` is the longest run ever.
 */
export function streakFrom(days: Iterable<string>, today: string): Streak {
  const set = new Set(days);
  if (set.size === 0) return { current: 0, best: 0, lastDay: null };
  const sorted = [...set].sort();
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    run = sorted[i] === addDays(sorted[i - 1], 1) ? run + 1 : 1;
    best = Math.max(best, run);
  }
  let current = 0;
  let day = set.has(today) ? today : addDays(today, -1);
  while (set.has(day)) {
    current++;
    day = addDays(day, -1);
  }
  return { current, best, lastDay: sorted[sorted.length - 1] };
}
