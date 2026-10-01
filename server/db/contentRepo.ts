import fs from "node:fs/promises";
import path from "node:path";
import {
  CourseSchema,
  ModuleSchema,
  UnitSchema,
  VocabFileSchema,
  VerbEntrySchema,
  ExamSchema,
} from "../../shared/schemas/content.js";
import type { Course, ModuleDef, Unit, VocabFile, VerbEntry, Exam } from "../../shared/types.js";

const COURSE_DIR = path.resolve("data/course");

export interface ContentError {
  file: string;
  message: string;
}

export interface ContentIndex {
  course: Course | null;
  modules: Map<string, ModuleDef>;
  units: Map<string, Unit>;
  vocabByTheme: Map<string, VocabFile>;
  vocabById: Map<string, VocabFile["entries"][number]>;
  verbs: Map<string, VerbEntry>;
  exams: Map<string, Exam>;
  errors: ContentError[];
}

async function readJsonFile(filePath: string): Promise<unknown> {
  const raw = await fs.readFile(filePath, "utf-8");
  return JSON.parse(raw);
}

async function listJsonFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await listJsonFiles(full)));
      } else if (entry.name.endsWith(".json")) {
        files.push(full);
      }
    }
    return files;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw err;
  }
}

export async function loadContent(): Promise<ContentIndex> {
  const index: ContentIndex = {
    course: null,
    modules: new Map(),
    units: new Map(),
    vocabByTheme: new Map(),
    vocabById: new Map(),
    verbs: new Map(),
    exams: new Map(),
    errors: [],
  };

  const coursePath = path.join(COURSE_DIR, "course.json");
  try {
    const raw = await readJsonFile(coursePath);
    const result = CourseSchema.safeParse(raw);
    if (result.success) index.course = result.data;
    else index.errors.push({ file: coursePath, message: result.error.message });
  } catch (err) {
    index.errors.push({ file: coursePath, message: String(err) });
  }

  const moduleIds = index.course?.modules ?? [];
  for (const moduleId of moduleIds) {
    const moduleDir = path.join(COURSE_DIR, moduleId);
    const modulePath = path.join(moduleDir, "module.json");
    try {
      const raw = await readJsonFile(modulePath);
      const result = ModuleSchema.safeParse(raw);
      if (result.success) {
        index.modules.set(result.data.id, result.data);
      } else {
        index.errors.push({ file: modulePath, message: result.error.message });
        continue;
      }
    } catch (err) {
      index.errors.push({ file: modulePath, message: String(err) });
      continue;
    }

    const unitsDir = path.join(moduleDir, "units");
    for (const file of await listJsonFiles(unitsDir)) {
      try {
        const raw = await readJsonFile(file);
        const result = UnitSchema.safeParse(raw);
        if (result.success) index.units.set(result.data.id, result.data);
        else index.errors.push({ file, message: result.error.message });
      } catch (err) {
        index.errors.push({ file, message: String(err) });
      }
    }

    const vocabDir = path.join(moduleDir, "vocab");
    for (const file of await listJsonFiles(vocabDir)) {
      try {
        const raw = await readJsonFile(file);
        const result = VocabFileSchema.safeParse(raw);
        if (result.success) {
          index.vocabByTheme.set(result.data.theme, result.data);
          for (const entry of result.data.entries) index.vocabById.set(entry.id, entry);
        } else {
          index.errors.push({ file, message: result.error.message });
        }
      } catch (err) {
        index.errors.push({ file, message: String(err) });
      }
    }

    const verbsPath = path.join(moduleDir, "verbs.json");
    try {
      const raw = await readJsonFile(verbsPath);
      if (Array.isArray(raw)) {
        for (const item of raw) {
          const result = VerbEntrySchema.safeParse(item);
          if (result.success) index.verbs.set(result.data.id, result.data);
          else index.errors.push({ file: verbsPath, message: result.error.message });
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
        index.errors.push({ file: verbsPath, message: String(err) });
      }
    }
  }

  const examsDir = path.join(COURSE_DIR, "exams");
  for (const file of await listJsonFiles(examsDir)) {
    if (path.basename(file) === "module.json") continue;
    try {
      const raw = await readJsonFile(file);
      const result = ExamSchema.safeParse(raw);
      if (result.success) index.exams.set(result.data.id, result.data);
      else index.errors.push({ file, message: result.error.message });
    } catch (err) {
      index.errors.push({ file, message: String(err) });
    }
  }

  return index;
}

let cached: ContentIndex | null = null;

export async function getContent(): Promise<ContentIndex> {
  if (!cached) cached = await loadContent();
  return cached;
}

export async function reloadContent(): Promise<ContentIndex> {
  cached = await loadContent();
  return cached;
}
