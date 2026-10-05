import { z } from "zod";
import {
  CourseSchema,
  ExamSchema,
  ModuleSchema,
  UnitSchema,
  VerbEntrySchema,
  VocabFileSchema,
} from "../schemas/content.js";
import type { Exam, ModuleDef, Unit, VerbEntry, VocabFile } from "../types.js";
import type { Content } from "./types.js";

/** The whole course as plain, already validated data (this is what gets bundled into the app). */
export interface ContentData {
  /** Short hash of the content. Written into progress files, to notice when the course changed. */
  version: string;
  course: { id: string; title: string };
  /** In course order. */
  modules: ModuleDef[];
  units: Unit[];
  vocab: VocabFile[];
  verbs: VerbEntry[];
  exams: Exam[];
  samenvatting: string;
  /** KNM facts per unit id (markdown). */
  facts: Record<string, string>;
}

export interface ContentError {
  file: string;
  message: string;
}

const EXAM_ORDER = ["lezen", "knm", "schrijven"];

const issues = (err: z.ZodError) => err.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("\n  ");

/**
 * Parses and validates the raw course files.
 * `files` maps a path relative to data/course (posix style, e.g. "basis/units/basis-tijd.json") to its text.
 * Never throws: problems are returned, so the caller can list them all at once.
 */
export function buildContentData(files: Record<string, string>): { data: ContentData; errors: ContentError[] } {
  const errors: ContentError[] = [];
  const fail = (file: string, message: string) => errors.push({ file, message });

  const parse = <T>(file: string, schema: z.ZodType<T, z.ZodTypeDef, unknown>): T | null => {
    let raw: unknown;
    try {
      raw = JSON.parse(files[file]);
    } catch (e) {
      fail(file, `Geen geldige JSON: ${(e as Error).message}`);
      return null;
    }
    const result = schema.safeParse(raw);
    if (!result.success) {
      fail(file, issues(result.error));
      return null;
    }
    return result.data;
  };

  const course = files["course.json"] !== undefined ? parse("course.json", CourseSchema) : (fail("course.json", "Bestand ontbreekt"), null);

  const modules: ModuleDef[] = [];
  for (const id of course?.modules ?? []) {
    const file = `${id}/module.json`;
    if (files[file] === undefined) {
      fail(file, "Bestand ontbreekt");
      continue;
    }
    const mod = parse(file, ModuleSchema);
    if (mod) modules.push(mod);
  }

  const units: Unit[] = [];
  const vocab: VocabFile[] = [];
  const verbs: VerbEntry[] = [];
  const exams: Exam[] = [];
  let samenvatting = "";
  const facts: Record<string, string> = {};
  const known = new Set(["course.json"]);

  for (const file of Object.keys(files).sort()) {
    let m: RegExpMatchArray | null;
    if (file === "course.json" || /^[^/]+\/module\.json$/.test(file)) {
      known.add(file);
    } else if ((m = file.match(/^([^/]+)\/units\/[^/]+\.json$/))) {
      const unit = parse(file, UnitSchema);
      if (unit) {
        if (unit.moduleId !== m[1]) fail(file, `moduleId "${unit.moduleId}" past niet bij de map "${m[1]}"`);
        units.push(unit);
      }
    } else if (/^[^/]+\/vocab\/[^/]+\.json$/.test(file)) {
      const v = parse(file, VocabFileSchema);
      if (v) vocab.push(v);
    } else if (/^[^/]+\/verbs\.json$/.test(file)) {
      const list = parse(file, z.array(VerbEntrySchema));
      if (list) verbs.push(...list);
    } else if (/^exams\/[^/]+\.json$/.test(file)) {
      const exam = parse(file, ExamSchema);
      if (exam) exams.push(exam);
    } else if (/^[^/]+\/samenvatting\.md$/.test(file)) {
      samenvatting = files[file];
    } else if ((m = file.match(/^knm\/facts\/(.+)\.md$/))) {
      facts[m[1]] = files[file];
    } else {
      fail(file, "Onbekend bestand: staat dit op de goede plek?");
      continue;
    }
    known.add(file);
  }

  exams.sort((a, b) => EXAM_ORDER.indexOf(a.skill) - EXAM_ORDER.indexOf(b.skill) || a.id.localeCompare(b.id));

  const data: ContentData = {
    version: "",
    course: course ? { id: course.id, title: course.title } : { id: "", title: "" },
    modules,
    units,
    vocab,
    verbs,
    exams,
    samenvatting,
    facts,
  };
  data.version = hashString(JSON.stringify({ ...data, version: "" }));
  return { data, errors };
}

/** Small, fast, non-cryptographic hash (FNV-1a) as 8 hex characters. Works in Node and in the browser. */
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

/** Turns the plain data into the lookup maps the services use. */
export function contentFromData(data: ContentData): Content {
  const units = new Map<string, Unit>();
  const byId = new Map(data.units.map((u) => [u.id, u]));
  // Units in course order first, then any that no module lists.
  for (const mod of data.modules) for (const id of mod.units) if (byId.has(id)) units.set(id, byId.get(id)!);
  for (const u of data.units) if (!units.has(u.id)) units.set(u.id, u);
  return {
    version: data.version,
    course: data.course,
    modules: new Map(data.modules.map((m) => [m.id, m])),
    units,
    vocabByTheme: new Map(data.vocab.map((v) => [v.theme, v])),
    vocabById: new Map(data.vocab.flatMap((v) => v.entries.map((e) => [e.id, e] as const))),
    verbs: new Map(data.verbs.map((v) => [v.id, v])),
    exams: new Map(data.exams.map((e) => [e.id, e])),
    samenvatting: data.samenvatting,
    facts: new Map(Object.entries(data.facts)),
  };
}
