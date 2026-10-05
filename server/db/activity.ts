import { addDays, dayString } from "../../shared/logic/srs.js";
import type { Progress } from "../../shared/types.js";

/** Record study time and update the day streak. Mutates `progress`. */
export function recordActivity(progress: Progress, durationMs: number, now = new Date(), capMs = 180_000): void {
  const today = dayString(now);
  progress.lastActivityAt = now.toISOString();
  // Cap one answer at 3 minutes so an idle tab does not inflate the minutes (exams pass a bigger cap).
  const minutes = Math.min(durationMs, capMs) / 60_000;
  progress.minutesByDay[today] = Math.round(((progress.minutesByDay[today] ?? 0) + minutes) * 100) / 100;

  const { lastDay } = progress.streak;
  if (lastDay === today) return;
  progress.streak.current = lastDay === addDays(today, -1) ? progress.streak.current + 1 : 1;
  progress.streak.best = Math.max(progress.streak.best, progress.streak.current);
  progress.streak.lastDay = today;
}
