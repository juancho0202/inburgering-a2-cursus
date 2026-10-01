import fs from "node:fs/promises";
import path from "node:path";
import type { ZodType, ZodTypeDef } from "zod";

const writeQueues = new Map<string, Promise<unknown>>();

function enqueue<T>(filePath: string, task: () => Promise<T>): Promise<T> {
  const previous = writeQueues.get(filePath) ?? Promise.resolve();
  const next = previous.then(task, task);
  writeQueues.set(
    filePath,
    next.catch(() => undefined),
  );
  return next;
}

export async function readJson<T>(filePath: string, schema: ZodType<T, ZodTypeDef, any>, fallback: T): Promise<T> {
  let raw: string;
  try {
    raw = await fs.readFile(filePath, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      await writeJson(filePath, fallback);
      return fallback;
    }
    throw err;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    await quarantine(filePath);
    return fallback;
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    console.warn(`[fileStore] invalid content in ${filePath}:`, result.error.message);
    await quarantine(filePath);
    return fallback;
  }
  return result.data;
}

async function quarantine(filePath: string) {
  try {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dir = path.dirname(filePath);
    const base = path.basename(filePath, ".json");
    const corruptPath = path.join(dir, `${base}.corrupt-${stamp}.json`);
    await fs.rename(filePath, corruptPath);
    console.warn(`[fileStore] moved corrupt file to ${corruptPath}`);
  } catch (err) {
    console.warn(`[fileStore] could not quarantine ${filePath}:`, err);
  }
}

export function writeJson(filePath: string, data: unknown): Promise<void> {
  return enqueue(filePath, async () => {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    const tmpPath = `${filePath}.tmp`;
    await fs.writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    await fs.rename(tmpPath, filePath);
  });
}

export function appendJsonl(filePath: string, obj: unknown): Promise<void> {
  return enqueue(filePath, async () => {
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(filePath, `${JSON.stringify(obj)}\n`, "utf-8");
  });
}

export async function readJsonl<T>(filePath: string): Promise<T[]> {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    return raw
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as T);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

const BACKUP_RETENTION_DAYS = 14;

export async function maybeMakeDailyBackup(userDir: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const backupsDir = path.join(userDir, "backups");
  const todayDir = path.join(backupsDir, today);

  try {
    await fs.access(todayDir);
    return;
  } catch {
    // doesn't exist yet, continue
  }

  await fs.mkdir(todayDir, { recursive: true });
  let entries: string[] = [];
  try {
    entries = await fs.readdir(userDir);
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry === "backups") continue;
    const src = path.join(userDir, entry);
    const stat = await fs.stat(src).catch(() => null);
    if (!stat || !stat.isFile()) continue;
    await fs.copyFile(src, path.join(todayDir, entry)).catch(() => undefined);
  }

  await pruneOldBackups(backupsDir);
}

async function pruneOldBackups(backupsDir: string): Promise<void> {
  let dirs: string[] = [];
  try {
    dirs = await fs.readdir(backupsDir);
  } catch {
    return;
  }
  const sorted = dirs.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort();
  const toRemove = sorted.slice(0, Math.max(0, sorted.length - BACKUP_RETENTION_DAYS));
  for (const dir of toRemove) {
    await fs.rm(path.join(backupsDir, dir), { recursive: true, force: true }).catch(() => undefined);
  }
}
