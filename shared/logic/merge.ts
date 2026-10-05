import type { ProgressData } from "../schemas/transfer.js";
import type {
  ExamRecord,
  GeneratedRecord,
  SrsCardRecord,
  UnitRecord,
  WritingRecord,
} from "../schemas/store.js";

/**
 * Merging two devices' progress. The rule that makes it safe: **a merge only ever adds or takes the newer
 * version, it never deletes.** Importing an older file therefore cannot undo newer work, and importing the
 * same file twice changes nothing. See docs/production-readiness.md §3.2.
 */

export interface CollectionCounts {
  /** In the file but not on this device yet. */
  new: number;
  /** On both, and the file's version wins. */
  updated: number;
  /** In the file in total. */
  total: number;
}

export interface MergePlan {
  /** Records to write (new ones and the winners that replace local ones), per collection. */
  writes: Pick<ProgressData, "attempts" | "units" | "srsCards" | "writing" | "examResults" | "explanations" | "generated" | "flags">;
  /** Present only when the file's value replaces the local one. */
  settings: ProgressData["settings"] | undefined;
  lastLocation: ProgressData["lastLocation"] | undefined;
  srsNewToday: ProgressData["srsNewToday"] | undefined;
  counts: Record<keyof MergePlan["writes"], CollectionCounts>;
}

const newest = <T extends { updatedAt: string }>(a: T, b: T): T => (b.updatedAt > a.updatedAt ? b : a);

/** Generic merge by id: `pick` returns the winner given (local, incoming). Incoming wins only if `pick` returns it. */
function mergeBy<T extends { id: string }>(local: T[], incoming: T[], pick: (local: T, incoming: T) => T): { writes: T[]; counts: CollectionCounts } {
  const byId = new Map(local.map((r) => [r.id, r]));
  const writes: T[] = [];
  let created = 0;
  let updated = 0;
  for (const inc of incoming) {
    const mine = byId.get(inc.id);
    if (!mine) {
      writes.push(inc);
      created++;
    } else if (pick(mine, inc) === inc) {
      writes.push(inc);
      updated++;
    }
  }
  return { writes, counts: { new: created, updated, total: incoming.length } };
}

const keepLocal = <T>(local: T) => local;

export function mergeUnit(local: UnitRecord, incoming: UnitRecord): UnitRecord {
  const base = newest(local, incoming);
  const scores = [local.bestScore, incoming.bestScore].filter((s): s is number => s !== null);
  const merged: UnitRecord = {
    ...base,
    status: local.status === "completed" || incoming.status === "completed" ? "completed" : "in_progress",
    bestScore: scores.length ? Math.max(...scores) : null,
    attempts: Math.max(local.attempts, incoming.attempts),
    completedAt: [local.completedAt, incoming.completedAt].filter((d): d is string => !!d).sort().pop() ?? null,
    updatedAt: base.updatedAt,
  };
  return merged;
}

const sameUnit = (a: UnitRecord, b: UnitRecord) =>
  a.status === b.status && a.bestScore === b.bestScore && a.attempts === b.attempts && a.stepIndex === b.stepIndex && a.completedAt === b.completedAt && a.updatedAt === b.updatedAt;

function mergeSrs(local: SrsCardRecord, incoming: SrsCardRecord): SrsCardRecord {
  if (incoming.updatedAt !== local.updatedAt) return incoming.updatedAt > local.updatedAt ? incoming : local;
  return incoming.reps > local.reps ? incoming : local; // same moment: the card with more reviews
}

function mergeWriting(local: WritingRecord, incoming: WritingRecord): WritingRecord {
  if (local.feedback && !incoming.feedback) return local;
  if (!local.feedback && incoming.feedback) return incoming;
  return local; // same text: nothing to gain
}

function mergeExam(local: ExamRecord, incoming: ExamRecord): ExamRecord {
  if (!!local.finishedAt !== !!incoming.finishedAt) return incoming.finishedAt ? incoming : local; // finished beats in progress
  if (local.finishedAt && incoming.finishedAt) {
    // Both finished: keep the one with more scored work (Claude feedback may have arrived on one device).
    return incoming.updatedAt > local.updatedAt ? incoming : local;
  }
  return incoming.updatedAt > local.updatedAt ? incoming : local;
}

function mergeGenerated(local: GeneratedRecord, incoming: GeneratedRecord): GeneratedRecord {
  // Hidden on any device means hidden everywhere ("Klopt niet" must not be undone by a merge).
  if (incoming.hidden && !local.hidden) return incoming;
  return local;
}

export function planMerge(local: ProgressData, incoming: ProgressData): MergePlan {
  const attempts = mergeBy(local.attempts, incoming.attempts, keepLocal);
  // Units are merged field by field (the result is a new record, not simply one of the two).
  const unitWrites: UnitRecord[] = [];
  let unitNew = 0;
  let unitUpdated = 0;
  const localUnits = new Map(local.units.map((u) => [u.id, u]));
  for (const inc of incoming.units) {
    const mine = localUnits.get(inc.id);
    if (!mine) {
      unitWrites.push(inc);
      unitNew++;
      continue;
    }
    const merged = mergeUnit(mine, inc);
    if (!sameUnit(merged, mine)) {
      unitWrites.push(merged);
      unitUpdated++;
    }
  }

  const srs = mergeBy(local.srsCards, incoming.srsCards, mergeSrs);
  const writing = mergeBy(local.writing, incoming.writing, mergeWriting);
  const exams = mergeBy(local.examResults, incoming.examResults, mergeExam);
  const explanations = mergeBy(local.explanations, incoming.explanations, keepLocal);
  const generated = mergeBy(local.generated, incoming.generated, mergeGenerated);
  const flags = mergeBy(local.flags, incoming.flags, keepLocal);

  const incSettings = incoming.settings;
  const settings = incSettings && (incSettings.updatedAt ?? "") > (local.settings?.updatedAt ?? "") ? incSettings : undefined;
  const lastLocation = incoming.lastLocation && (incoming.lastLocation.updatedAt > (local.lastLocation?.updatedAt ?? "")) ? incoming.lastLocation : undefined;
  // Words introduced today: on the same day keep the higher count, so a second device does not give a fresh daily allowance.
  const srsNewToday =
    incoming.srsNewToday && local.srsNewToday && incoming.srsNewToday.day === local.srsNewToday.day && incoming.srsNewToday.count > local.srsNewToday.count
      ? incoming.srsNewToday
      : incoming.srsNewToday && (!local.srsNewToday || incoming.srsNewToday.day > local.srsNewToday.day)
        ? incoming.srsNewToday
        : undefined;

  return {
    writes: {
      attempts: attempts.writes,
      units: unitWrites,
      srsCards: srs.writes,
      writing: writing.writes,
      examResults: exams.writes,
      explanations: explanations.writes,
      generated: generated.writes,
      flags: flags.writes,
    },
    settings,
    lastLocation,
    srsNewToday,
    counts: {
      attempts: attempts.counts,
      units: { new: unitNew, updated: unitUpdated, total: incoming.units.length },
      srsCards: srs.counts,
      writing: writing.counts,
      examResults: exams.counts,
      explanations: explanations.counts,
      generated: generated.counts,
      flags: flags.counts,
    },
  };
}

/** True when importing the file would change nothing on this device. */
export function isNothingNew(plan: MergePlan): boolean {
  return (
    Object.values(plan.writes).every((list) => list.length === 0) &&
    plan.settings === undefined &&
    plan.lastLocation === undefined &&
    plan.srsNewToday === undefined
  );
}
