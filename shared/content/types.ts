import type { Exam, ModuleDef, Unit, VerbEntry, VocabEntry, VocabFile } from "../types.js";

/** The course, as the services see it. Built from the JSON files (step 2: at build time). */
export interface Content {
  /** Content version hash (see ContentData.version). */
  version: string;
  course: { id: string; title: string };
  /** In course order. */
  modules: Map<string, ModuleDef>;
  units: Map<string, Unit>;
  vocabByTheme: Map<string, VocabFile>;
  vocabById: Map<string, VocabEntry>;
  verbs: Map<string, VerbEntry>;
  exams: Map<string, Exam>;
  /** The learner's own samenvatting (markdown). */
  samenvatting: string;
  /** KNM facts per unit id (markdown), used to keep generated questions factual. */
  facts: Map<string, string>;
}
