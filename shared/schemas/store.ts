import { z } from "zod";
import { ExerciseSchema } from "./content.js";
import { ExplanationSchema } from "./claude.js";
import { ExamResultSchema, SrsCardSchema, UnitProgressSchema, WritingSubmissionSchema } from "./progress.js";

/**
 * Records in the local-first data store (see docs/production-readiness.md §3.2).
 * Facts are append-only events with unique ids; totals are derived from them, so two devices can be merged.
 */

/** One answered question (also exam answers, writing-error checks and exam time). */
export const AttemptRecordSchema = z.object({
  id: z.string(),
  itemId: z.string(),
  exerciseType: z.string(),
  correct: z.boolean(),
  answer: z.unknown().optional(),
  /** Study time for this answer in ms, already capped (an idle tab must not count as study time). */
  durationMs: z.number().int().min(0),
  at: z.string(),
  deviceId: z.string(),
});
export type AttemptRecord = z.infer<typeof AttemptRecordSchema>;

/** What the UI sends when it saves an answer. */
export const AttemptInputSchema = z.object({
  itemId: z.string(),
  exerciseType: z.string(),
  correct: z.boolean(),
  answer: z.unknown().optional(),
  durationMs: z.number().int().min(0),
});
export type AttemptInput = z.infer<typeof AttemptInputSchema>;

export const UnitRecordSchema = UnitProgressSchema.extend({ id: z.string(), updatedAt: z.string() });
export type UnitRecord = z.infer<typeof UnitRecordSchema>;

export const SrsCardRecordSchema = SrsCardSchema.extend({ updatedAt: z.string() });
export type SrsCardRecord = z.infer<typeof SrsCardRecordSchema>;

export const WritingRecordSchema = WritingSubmissionSchema;
export type WritingRecord = z.infer<typeof WritingRecordSchema>;

export const ExamRecordSchema = ExamResultSchema.extend({ id: z.string(), updatedAt: z.string() });
export type ExamRecord = z.infer<typeof ExamRecordSchema>;

export const ExplanationRecordSchema = ExplanationSchema.extend({ id: z.string(), createdAt: z.string() });
export type ExplanationRecord = z.infer<typeof ExplanationRecordSchema>;

/** An exercise made by Claude. It is user data, not course content. */
export const GeneratedRecordSchema = z.object({
  id: z.string(),
  unitId: z.string(),
  exercise: ExerciseSchema,
  hidden: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type GeneratedRecord = z.infer<typeof GeneratedRecordSchema>;

/** "Meld een fout" note on a lesson or exercise. */
export const FlagRecordSchema = z.object({ id: z.string(), itemId: z.string(), note: z.string(), at: z.string() });
export type FlagRecord = z.infer<typeof FlagRecordSchema>;

// ----- key-value records -----
/** Languages the app's own text (menus, buttons, help) can be shown in. The learning material is always Dutch. */
export const UI_LANGUAGES = ["en", "nl", "es"] as const;
export type UiLanguage = (typeof UI_LANGUAGES)[number];

export const SettingsRecordSchema = z.object({
  model: z.string(),
  dailyGoalMinutes: z.number().int(),
  newCardsPerDay: z.number().int(),
  speechRate: z.number(),
  spellcheckWriting: z.boolean(),
  theme: z.enum(["light", "dark", "system"]),
  /** Short chimes on right/wrong answers and at the end of a lesson. */
  soundEffects: z.boolean().default(true),
  /** Read the lesson title and each question aloud (Dutch voice). */
  voiceAnnouncements: z.boolean().default(true),
  /** A short melody at the start of a lesson: one per lesson number, a little different per module. */
  lessonMusic: z.boolean().default(true),
  /** Module ids in the order the learner put them on the start page; modules not listed follow in course order. */
  moduleOrder: z.array(z.string()).default([]),
  /** The learner's own language for the app's text. Not set until they choose one (the first-visit picker). */
  language: z.enum(UI_LANGUAGES).optional(),
  /**
   * How much of the app's own text is Dutch: 0 = my language, 1 = Dutch with my language, 2 = Dutch only.
   * Ignored when the language is Dutch. Learned app words are Dutch at every level.
   */
  immersion: z.number().int().min(0).max(2).default(1),
  /** Feedback after an answer is Dutch first; this shows it in the learner's language instead. */
  feedbackInMyLanguage: z.boolean().default(false),
  updatedAt: z.string().optional(),
});
export type SettingsRecord = z.infer<typeof SettingsRecordSchema>;
export const defaultSettingsRecord = (): SettingsRecord => ({
  model: "claude-sonnet-5-5",
  dailyGoalMinutes: 30,
  newCardsPerDay: 15,
  speechRate: 0.95,
  spellcheckWriting: false,
  theme: "system",
  soundEffects: true,
  voiceAnnouncements: true,
  lessonMusic: true,
  moduleOrder: [],
  immersion: 1,
  feedbackInMyLanguage: false,
});

export const UsageRecordSchema = z.object({ month: z.string(), requests: z.number().int(), inputTokens: z.number().int(), outputTokens: z.number().int() });
export type UsageRecord = z.infer<typeof UsageRecordSchema>;

export const LastLocationSchema = z.object({ unitId: z.string(), stepIndex: z.number().int(), updatedAt: z.string() });
export type LastLocation = z.infer<typeof LastLocationSchema>;

export const NewTodaySchema = z.object({ day: z.string(), count: z.number().int() });
export type NewToday = z.infer<typeof NewTodaySchema>;

export const MetaRecordSchema = z.object({
  deviceId: z.string(),
  deviceName: z.string().optional(),
  /** When a progress file was last saved/shared from this device (for the "not saved for X days" reminder). */
  lastExportAt: z.string().optional(),
  lastImportAt: z.string().optional(),
});
export type MetaRecord = z.infer<typeof MetaRecordSchema>;

/** Names of the key-value entries. */
export const KV = {
  settings: "settings",
  usage: "usage",
  lastLocation: "lastLocation",
  srsNewToday: "srsNewToday",
  meta: "meta",
  welcomeSeen: "welcomeSeen",
} as const;
