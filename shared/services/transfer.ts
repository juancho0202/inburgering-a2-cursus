import { z } from "zod";
import { planMerge, isNothingNew, type MergePlan } from "../logic/merge.js";
import { addDays, dayString } from "../logic/srs.js";
import { minutesByDay } from "../logic/stats.js";
import {
  KV,
  type AttemptRecord,
  type ExamRecord,
  type LastLocation,
  type MetaRecord,
  type NewToday,
  type SettingsRecord,
  type SrsCardRecord,
  type UnitRecord,
} from "../schemas/store.js";
import {
  PROGRESS_FILE_FORMAT,
  PROGRESS_FILE_VERSION,
  ProgressFileSchema,
  emptyProgressData,
  type ProgressData,
  type ProgressFile,
} from "../schemas/transfer.js";
import { ServiceError, deviceId, invalid, now, nowIso, today, type Env } from "./context.js";
import type { Exercise } from "../types.js";

const SNAPSHOT_KEY = "importSnapshot";

// ---------- building the data bundle ----------

/** Everything the learner saved, read from the store. The API key is not in the store, so it cannot be in here. */
export async function readProgressData(env: Env): Promise<ProgressData> {
  const s = env.store;
  const [attempts, units, srsCards, writing, examResults, explanations, generated, flags, settings, lastLocation, srsNewToday] = await Promise.all([
    s.attempts.all(),
    s.units.all(),
    s.srsCards.all(),
    s.writing.all(),
    s.examResults.all(),
    s.explanations.all(),
    s.generated.all(),
    s.flags.all(),
    s.kv.get<SettingsRecord>(KV.settings),
    s.kv.get<LastLocation>(KV.lastLocation),
    s.kv.get<NewToday>(KV.srsNewToday),
  ]);
  return { attempts, units, srsCards, writing, examResults, explanations, generated, flags, settings: settings ?? null, lastLocation: lastLocation ?? null, srsNewToday: srsNewToday ?? null };
}

export async function buildProgressFile(env: Env): Promise<ProgressFile> {
  const meta = await env.store.kv.get<MetaRecord>(KV.meta);
  return {
    format: PROGRESS_FILE_FORMAT,
    version: PROGRESS_FILE_VERSION,
    exportedAt: nowIso(env),
    device: { id: await deviceId(env), name: meta?.deviceName ?? null },
    contentVersion: env.content.version,
    data: await readProgressData(env),
  };
}

// ---------- reading a file (current format, or the old server export) ----------

const FILE_PROBLEM = "Dit is geen voortgangsbestand van deze app.";

/** Validates a file and converts the old (server) export to the current format. Throws a ServiceError in Dutch. */
export function parseProgressFile(raw: unknown): { file: ProgressFile; legacy: boolean } {
  if (!raw || typeof raw !== "object") throw new ServiceError(400, "invalid_file", FILE_PROBLEM);
  const obj = raw as Record<string, unknown>;

  if (obj.format === PROGRESS_FILE_FORMAT) {
    if (obj.version !== PROGRESS_FILE_VERSION) {
      throw new ServiceError(400, "unsupported_version", "Dit bestand komt van een nieuwere versie van de app. Werk de app bij en probeer het opnieuw.");
    }
    const parsed = ProgressFileSchema.safeParse(obj);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      throw new ServiceError(400, "invalid_file", `Het bestand is beschadigd (${first.path.join(".")}: ${first.message}).`);
    }
    return { file: parsed.data, legacy: false };
  }

  if (obj.files && typeof obj.files === "object" && (obj.files as Record<string, unknown>)["progress.json"]) {
    return { file: convertLegacyExport(obj as unknown as LegacyExport), legacy: true };
  }
  throw new ServiceError(400, "invalid_file", FILE_PROBLEM);
}

interface LegacyExport {
  exportedAt?: string;
  files: Record<string, any>;
}

/**
 * The server version saved progress as files (items with counts, an attempts log, ...). Converting keeps the
 * numbers: attempts get stable ids ("v1-…"), so importing the same old file twice adds nothing; items that have
 * more "seen" than logged attempts get synthetic attempts, so the derived stats stay the same.
 * The API key (settings.json) is never carried over.
 */
export function convertLegacyExport(legacy: LegacyExport): ProgressFile {
  const f = legacy.files;
  const progress = f["progress.json"] ?? {};
  const exportedAt: string = legacy.exportedAt ?? progress.lastActivityAt ?? new Date(0).toISOString();
  const startedAt: string = progress.startedAt ?? exportedAt;
  const data = emptyProgressData();

  const log: any[] = Array.isArray(f["attempts.jsonl"]) ? f["attempts.jsonl"] : [];
  const seenInLog = new Map<string, { n: number; correct: number }>();
  log.forEach((a, i) => {
    if (!a || typeof a.itemId !== "string") return;
    const rec: AttemptRecord = {
      id: `v1-${i}`,
      itemId: a.itemId,
      exerciseType: String(a.exerciseType ?? "mc"),
      correct: !!a.correct,
      answer: a.answer ?? null,
      durationMs: Math.max(0, Math.min(Number(a.durationMs) || 0, 180_000)),
      at: String(a.at ?? startedAt),
      deviceId: "v1",
    };
    data.attempts.push(rec);
    const c = seenInLog.get(a.itemId) ?? { n: 0, correct: 0 };
    c.n++;
    if (rec.correct) c.correct++;
    seenInLog.set(a.itemId, c);
  });

  for (const [itemId, item] of Object.entries<any>(progress.items ?? {})) {
    const logged = seenInLog.get(itemId) ?? { n: 0, correct: 0 };
    const missing = Math.max(0, (item.seen ?? 0) - logged.n);
    if (!missing) continue;
    const correctMissing = Math.min(missing, Math.max(0, (item.correct ?? 0) - logged.correct));
    for (let i = 0; i < missing; i++) {
      const isLast = i === missing - 1;
      // The last synthetic attempt carries the real "last result"; the others share out the remaining correct ones.
      const correct = isLast ? !!item.lastCorrect : i < correctMissing - (item.lastCorrect ? 1 : 0);
      data.attempts.push({ id: `v1-synth-${itemId}-${i}`, itemId, exerciseType: "legacy", correct, answer: null, durationMs: 0, at: item.lastSeenAt ?? startedAt, deviceId: "v1" });
    }
  }

  for (const [id, u] of Object.entries<any>(progress.units ?? {})) {
    data.units.push({
      id,
      status: u.status === "completed" ? "completed" : "in_progress",
      bestScore: u.bestScore ?? null,
      attempts: u.attempts ?? 0,
      stepIndex: u.stepIndex ?? 0,
      completedAt: u.completedAt ?? null,
      updatedAt: u.completedAt ?? progress.lastActivityAt ?? startedAt,
    } satisfies UnitRecord);
  }

  for (const c of Object.values<any>(f["srs.json"]?.cards ?? {})) {
    data.srsCards.push({ ...c, updatedAt: c.lastReviewedAt ?? startedAt } satisfies SrsCardRecord);
  }
  const newToday = f["srs.json"]?.newToday;
  data.srsNewToday = newToday?.day ? { day: newToday.day, count: newToday.count ?? 0 } : null;

  for (const s of f["writing.json"]?.submissions ?? []) data.writing.push({ id: s.id, exerciseId: s.exerciseId, text: s.text, submittedAt: s.submittedAt, feedback: s.feedback ?? null });

  for (const [key, e] of Object.entries<any>(f["explanations.json"]?.entries ?? {})) {
    data.explanations.push({ id: key, explanation: e.explanation, rule: e.rule ?? null, extraExamples: e.extraExamples ?? [], createdAt: startedAt });
  }

  for (const r of progress.exams ?? []) {
    data.examResults.push({
      ...r,
      id: r.id ?? `v1-exam-${r.startedAt}`,
      flagged: r.flagged ?? [],
      position: r.position ?? 0,
      details: r.details ?? {},
      updatedAt: r.finishedAt ?? r.startedAt,
    } satisfies ExamRecord);
  }

  if (progress.lastLocation) {
    data.lastLocation = { unitId: progress.lastLocation.unitId, stepIndex: progress.lastLocation.stepIndex, updatedAt: progress.lastActivityAt ?? startedAt };
  }

  const st = f["settings.json"];
  if (st && typeof st === "object") {
    // Everything except the API key (and the usage counter, which belongs to the old server).
    data.settings = {
      model: st.model ?? "claude-sonnet-5-5",
      dailyGoalMinutes: st.dailyGoalMinutes ?? 30,
      newCardsPerDay: st.newCardsPerDay ?? 15,
      speechRate: st.speechRate ?? 0.95,
      spellcheckWriting: st.spellcheckWriting ?? false,
      theme: st.theme ?? "system",
      updatedAt: progress.lastActivityAt ?? startedAt,
    };
  }

  return { format: PROGRESS_FILE_FORMAT, version: PROGRESS_FILE_VERSION, exportedAt, device: { id: "v1", name: "Oude versie" }, contentVersion: "v1", data };
}

// ---------- preview and import ----------

export interface ImportPreview {
  from: { deviceName: string | null; exportedAt: string; legacy: boolean };
  /** The file was made with another version of the course. Ids that no longer exist are kept but not shown. */
  contentChanged: boolean;
  unknownItems: number;
  counts: MergePlan["counts"];
  settingsReplaced: boolean;
  lastLocationReplaced: boolean;
  nothingNew: boolean;
}

async function plan(env: Env, fileRaw: unknown) {
  const { file, legacy } = parseProgressFile(fileRaw);
  const merge = planMerge(await readProgressData(env), file.data);
  return { file, legacy, merge };
}

/** Units and answers in the file that this version of the course does not have (the course may have changed). */
function unknownItemCount(env: Env, file: ProgressFile): number {
  const known = new Set<string>();
  const addExercise = (ex: Exercise) => {
    known.add(ex.id);
    if (ex.type === "reading") for (const q of ex.questions) known.add(q.id);
  };
  for (const u of env.content.units.values()) for (const s of u.steps) if (s.type === "exercise") addExercise(s.exercise);
  for (const e of env.content.exams.values()) {
    known.add(e.id);
    for (const item of e.items) if ("type" in item) addExercise(item);
  }
  for (const g of file.data.generated) addExercise(g.exercise);
  const unitsUnknown = file.data.units.filter((u) => !env.content.units.has(u.id)).length;
  const attemptsUnknown = file.data.attempts.filter((a) => !a.itemId.startsWith("writing:") && !known.has(a.itemId)).length;
  return unitsUnknown + attemptsUnknown;
}

/** What importing would do, without doing it. */
export async function previewImport(env: Env, body: unknown): Promise<ImportPreview> {
  const raw = (body as { file?: unknown } | undefined)?.file;
  if (raw === undefined) throw invalid("Kies eerst een bestand.");
  const { file, legacy, merge } = await plan(env, raw);
  return {
    from: { deviceName: file.device.name, exportedAt: file.exportedAt, legacy },
    contentChanged: !legacy && file.contentVersion !== env.content.version,
    unknownItems: unknownItemCount(env, file),
    counts: merge.counts,
    settingsReplaced: merge.settings !== undefined,
    lastLocationReplaced: merge.lastLocation !== undefined,
    nothingNew: isNothingNew(merge),
  };
}

/** Merges the file into this device. A safety copy is made first, so the last import can be undone. */
export async function applyImport(env: Env, body: unknown): Promise<ImportPreview & { importedAt: string }> {
  const raw = (body as { file?: unknown } | undefined)?.file;
  if (raw === undefined) throw invalid("Kies eerst een bestand.");
  const { file, merge } = await plan(env, raw);
  const preview = await previewImport(env, body);
  if (isNothingNew(merge)) return { ...preview, importedAt: nowIso(env) };

  const importedAt = nowIso(env);
  await env.store.kv.set(SNAPSHOT_KEY, { at: importedAt, from: file.device.name, data: await readProgressData(env) });

  const w = merge.writes;
  const s = env.store;
  await Promise.all([
    s.attempts.putMany(w.attempts),
    s.units.putMany(w.units),
    s.srsCards.putMany(w.srsCards),
    s.writing.putMany(w.writing),
    s.examResults.putMany(w.examResults),
    s.explanations.putMany(w.explanations),
    s.generated.putMany(w.generated),
    s.flags.putMany(w.flags),
  ]);
  if (merge.settings) await s.kv.set(KV.settings, merge.settings);
  if (merge.lastLocation) await s.kv.set(KV.lastLocation, merge.lastLocation);
  if (merge.srsNewToday) await s.kv.set(KV.srsNewToday, merge.srsNewToday);
  await updateMeta(env, { lastImportAt: importedAt });
  return { ...preview, importedAt };
}

/** The last import (if its safety copy is still there). */
export async function lastImport(env: Env): Promise<{ at: string; from: string | null } | null> {
  const snap = await env.store.kv.get<{ at: string; from: string | null }>(SNAPSHOT_KEY);
  return snap ? { at: snap.at, from: snap.from } : null;
}

/** Puts everything back as it was before the last import. */
export async function undoLastImport(env: Env): Promise<{ ok: true }> {
  const snap = await env.store.kv.get<{ at: string; data: ProgressData }>(SNAPSHOT_KEY);
  if (!snap) throw new ServiceError(404, "not_found", "Er is geen import om ongedaan te maken.");
  const s = env.store;
  const d = snap.data;
  await Promise.all([s.attempts.clear(), s.units.clear(), s.srsCards.clear(), s.writing.clear(), s.examResults.clear(), s.explanations.clear(), s.generated.clear(), s.flags.clear()]);
  await Promise.all([
    s.attempts.putMany(d.attempts),
    s.units.putMany(d.units),
    s.srsCards.putMany(d.srsCards),
    s.writing.putMany(d.writing),
    s.examResults.putMany(d.examResults),
    s.explanations.putMany(d.explanations),
    s.generated.putMany(d.generated),
    s.flags.putMany(d.flags),
  ]);
  for (const [key, value] of [[KV.settings, d.settings], [KV.lastLocation, d.lastLocation], [KV.srsNewToday, d.srsNewToday]] as const) {
    if (value) await s.kv.set(key, value);
    else await s.kv.delete(key);
  }
  await s.kv.delete(SNAPSHOT_KEY);
  return { ok: true };
}

// ---------- device, "Klaar voor vandaag", reminder ----------

async function updateMeta(env: Env, patch: Partial<MetaRecord>) {
  const meta = { deviceId: await deviceId(env), ...(await env.store.kv.get<MetaRecord>(KV.meta)), ...patch };
  await env.store.kv.set(KV.meta, meta);
}

const DeviceNameSchema = z.object({ name: z.string().trim().max(40) });

export async function getDevice(env: Env) {
  const meta = await env.store.kv.get<MetaRecord>(KV.meta);
  return { id: await deviceId(env), name: meta?.deviceName ?? null, lastExportAt: meta?.lastExportAt ?? null, lastImportAt: meta?.lastImportAt ?? null };
}

export async function setDeviceName(env: Env, body: unknown) {
  const parsed = DeviceNameSchema.safeParse(body);
  if (!parsed.success) throw invalid("Kies een korte naam voor dit apparaat, bijvoorbeeld Laptop.");
  await updateMeta(env, { deviceName: parsed.data.name || undefined });
  return getDevice(env);
}

/** Call this after the file was saved or shared. It resets the "not saved for X days" reminder. */
export async function markExported(env: Env) {
  await updateMeta(env, { lastExportAt: nowIso(env) });
  return getDevice(env);
}

/** Summary for the "Klaar voor vandaag" dialog. */
export async function sessionSummary(env: Env) {
  const day = today(env);
  const [attempts, meta, units] = await Promise.all([env.store.attempts.all(), env.store.kv.get<MetaRecord>(KV.meta), env.store.units.all()]);
  const todays = attempts.filter((a) => dayString(new Date(a.at)) === day && a.exerciseType !== "exam-time" && a.exerciseType !== "writing-check");
  const minutes = minutesByDay(attempts)[day] ?? 0;
  return {
    minutesToday: Math.round(minutes * 10) / 10,
    answersToday: todays.length,
    correctToday: todays.filter((a) => a.correct).length,
    unitsCompletedToday: units.filter((u) => u.completedAt && dayString(new Date(u.completedAt)) === day).length,
    unsavedAnswers: attempts.filter((a) => !meta?.lastExportAt || a.at > meta.lastExportAt).length,
    lastExportAt: meta?.lastExportAt ?? null,
    deviceName: meta?.deviceName ?? null,
  };
}

/** The dashboard reminder: there is unsaved work and the last save is more than 2 days ago (or never). */
export async function backupReminder(env: Env) {
  const s = await sessionSummary(env);
  const limit = addDays(today(env), -2);
  const stale = !s.lastExportAt || dayString(new Date(s.lastExportAt)) <= limit;
  const daysAgo = s.lastExportAt ? Math.round((now(env).getTime() - new Date(s.lastExportAt).getTime()) / 86_400_000) : null;
  return { show: s.unsavedAnswers > 0 && stale, daysAgo, unsavedAnswers: s.unsavedAnswers };
}

