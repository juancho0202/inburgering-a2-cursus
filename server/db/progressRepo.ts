import path from "node:path";
import { readJson, writeJson, appendJsonl } from "./fileStore.js";
import {
  ProgressSchema,
  SrsStateSchema,
  SettingsSchema,
  WritingFileSchema,
  defaultProgress,
  defaultSrs,
  defaultSettings,
  defaultWriting,
} from "../../shared/schemas/progress.js";
import type { Attempt, Progress, Settings, SrsState, WritingSubmission } from "../../shared/types.js";

const USER_DIR = path.resolve("data/user");
const PROGRESS_PATH = path.join(USER_DIR, "progress.json");
const SRS_PATH = path.join(USER_DIR, "srs.json");
const SETTINGS_PATH = path.join(USER_DIR, "settings.json");
const WRITING_PATH = path.join(USER_DIR, "writing.json");
const ATTEMPTS_PATH = path.join(USER_DIR, "attempts.jsonl");

export const userDir = USER_DIR;

export function loadProgress(): Promise<Progress> {
  return readJson<Progress>(PROGRESS_PATH, ProgressSchema, defaultProgress());
}

export function saveProgress(progress: Progress): Promise<void> {
  return writeJson(PROGRESS_PATH, progress);
}

export function loadSrs(): Promise<SrsState> {
  return readJson<SrsState>(SRS_PATH, SrsStateSchema, defaultSrs());
}

export function saveSrs(srs: SrsState): Promise<void> {
  return writeJson(SRS_PATH, srs);
}

export function loadSettings(): Promise<Settings> {
  return readJson<Settings>(SETTINGS_PATH, SettingsSchema, defaultSettings());
}

export function saveSettings(settings: Settings): Promise<void> {
  return writeJson(SETTINGS_PATH, settings);
}

export async function loadWriting() {
  return readJson(WRITING_PATH, WritingFileSchema, defaultWriting());
}

export async function saveWritingSubmission(sub: WritingSubmission): Promise<void> {
  const file = await loadWriting();
  file.submissions.push(sub);
  await writeJson(WRITING_PATH, file);
}

export function appendAttempt(attempt: Attempt): Promise<void> {
  return appendJsonl(ATTEMPTS_PATH, { ...attempt, at: attempt.at ?? new Date().toISOString() });
}
