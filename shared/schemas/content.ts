import { z } from "zod";

export const CourseSchema = z.object({
  id: z.string(),
  title: z.string(),
  modules: z.array(z.string()),
});

export const ModuleSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  units: z.array(z.string()),
});

export const LessonBlockSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), md: z.string() }),
  z.object({
    kind: z.literal("table"),
    headers: z.array(z.string()),
    rows: z.array(z.array(z.string())),
  }),
  z.object({ kind: z.literal("tip"), md: z.string() }),
  z.object({ kind: z.literal("example"), nl: z.string(), note: z.string().optional() }),
  z.object({ kind: z.literal("vocab"), ids: z.array(z.string()) }),
  z.object({
    kind: z.literal("dialogue"),
    lines: z.array(z.object({ speaker: z.string(), nl: z.string() })),
  }),
  z.object({
    kind: z.literal("document"),
    docType: z.enum(["brief", "email", "advertentie", "formulier", "bericht", "rooster", "folder"]),
    title: z.string(),
    body: z.string(),
  }),
]);

export type LessonBlock = z.infer<typeof LessonBlockSchema>;

interface ExerciseBaseFields {
  id: string;
  tags: string[];
  prompt: string;
  context?: string;
  explanation: string;
  difficulty: 1 | 2 | 3;
}

export type Exercise =
  | (ExerciseBaseFields & { type: "mc"; options: string[]; answer: number })
  | (ExerciseBaseFields & { type: "mc-multi"; options: string[]; answers: number[] })
  | (ExerciseBaseFields & { type: "true-false"; statement: string; answer: boolean })
  | (ExerciseBaseFields & { type: "gap-fill"; text: string; answers: string[][] })
  | (ExerciseBaseFields & { type: "gap-choice"; text: string; options: string[][]; answers: number[] })
  | (ExerciseBaseFields & { type: "word-order"; tokens: string[]; alsoAccepted?: string[][] })
  | (ExerciseBaseFields & { type: "match"; pairs: [string, string][] })
  | (ExerciseBaseFields & {
      type: "conjugate";
      verbId: string;
      person: string;
      tense: "present" | "perfect" | "past";
      answers: string[];
    })
  | (ExerciseBaseFields & { type: "reading"; document: LessonBlock; questions: Exercise[] })
  | (ExerciseBaseFields & {
      type: "form-fill";
      formTitle: string;
      scenario: string;
      fields: { label: string; kind: string; expected?: string; hint?: string }[];
    })
  | (ExerciseBaseFields & {
      type: "writing";
      task: { instructions: string; scenario: string; requiredPoints: string[] };
      minWords: number;
      maxWords: number;
      requiredPoints?: string[];
      modelAnswer: string;
      checklist: string[];
      register: "informal" | "formal";
    });

const ExerciseBase = {
  id: z.string(),
  tags: z.array(z.string()).default([]),
  prompt: z.string(),
  context: z.string().optional(),
  explanation: z.string(),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(1),
};

export const ExerciseSchema: z.ZodType<Exercise, z.ZodTypeDef, any> = z.discriminatedUnion("type", [
  z.object({ ...ExerciseBase, type: z.literal("mc"), options: z.array(z.string()).min(2), answer: z.number().int() }),
  z.object({ ...ExerciseBase, type: z.literal("mc-multi"), options: z.array(z.string()).min(2), answers: z.array(z.number().int()) }),
  z.object({ ...ExerciseBase, type: z.literal("true-false"), statement: z.string(), answer: z.boolean() }),
  z.object({ ...ExerciseBase, type: z.literal("gap-fill"), text: z.string(), answers: z.array(z.array(z.string())) }),
  z.object({ ...ExerciseBase, type: z.literal("gap-choice"), text: z.string(), options: z.array(z.array(z.string())), answers: z.array(z.number().int()) }),
  z.object({ ...ExerciseBase, type: z.literal("word-order"), tokens: z.array(z.string()).min(1), alsoAccepted: z.array(z.array(z.string())).optional() }),
  z.object({ ...ExerciseBase, type: z.literal("match"), pairs: z.array(z.tuple([z.string(), z.string()])) }),
  z.object({
    ...ExerciseBase,
    type: z.literal("conjugate"),
    verbId: z.string(),
    person: z.string(),
    tense: z.enum(["present", "perfect", "past"]),
    answers: z.array(z.string()),
  }),
  z.object({
    ...ExerciseBase,
    type: z.literal("reading"),
    document: LessonBlockSchema,
    questions: z.array(z.lazy(() => ExerciseSchema)),
  }),
  z.object({
    ...ExerciseBase,
    type: z.literal("form-fill"),
    formTitle: z.string(),
    scenario: z.string(),
    fields: z.array(z.object({ label: z.string(), kind: z.string(), expected: z.string().optional(), hint: z.string().optional() })),
  }),
  z.object({
    ...ExerciseBase,
    type: z.literal("writing"),
    task: z.object({
      instructions: z.string(),
      scenario: z.string(),
      requiredPoints: z.array(z.string()).min(2).max(4),
    }),
    minWords: z.number().int(),
    maxWords: z.number().int(),
    requiredPoints: z.array(z.string()).optional(),
    modelAnswer: z.string(),
    checklist: z.array(z.string()),
    register: z.enum(["informal", "formal"]),
  }),
]);

export const StepSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("lesson"), id: z.string(), title: z.string(), blocks: z.array(LessonBlockSchema) }),
  z.object({ type: z.literal("exercise"), exercise: ExerciseSchema }),
]);

export const UnitSchema = z.object({
  id: z.string(),
  moduleId: z.string(),
  title: z.string(),
  goal: z.string(),
  estimatedMinutes: z.number().int(),
  tags: z.array(z.string()).default([]),
  vocabRefs: z.array(z.string()).default([]),
  steps: z.array(StepSchema),
  passScore: z.number().min(0).max(1).default(0.7),
});

export const VocabEntrySchema = z.object({
  id: z.string(),
  nl: z.string(),
  article: z.enum(["de", "het"]).nullable(),
  pos: z.enum(["noun", "verb", "adj", "adv", "phrase", "prep", "other"]),
  plural: z.string().nullable().optional(),
  definitionNl: z.string(),
  example: z.string(),
  tags: z.array(z.string()).default([]),
  level: z.enum(["A1", "A2"]),
  source: z.enum(["samenvatting", "learner-notes", "course", "generated"]),
});

export const VocabFileSchema = z.object({
  theme: z.string(),
  title: z.string(),
  entries: z.array(VocabEntrySchema),
});

export const VerbEntrySchema = z.object({
  id: z.string(),
  infinitive: z.string(),
  separable: z.boolean(),
  prefix: z.string().nullable().optional(),
  present: z.object({ ik: z.string(), jij: z.string(), hij: z.string(), wij: z.string() }),
  past: z.object({ sg: z.string(), pl: z.string() }),
  participle: z.string(),
  auxiliary: z.enum(["hebben", "zijn", "both"]),
  irregular: z.boolean(),
  definitionNl: z.string(),
  example: z.string(),
});

export const ExamSchema = z.object({
  id: z.string(),
  skill: z.enum(["lezen", "knm", "schrijven"]),
  title: z.string(),
  durationMinutes: z.number().int(),
  items: z.array(z.union([ExerciseSchema, z.object({ ref: z.string() })])),
  passScore: z.number().min(0).max(1),
});
