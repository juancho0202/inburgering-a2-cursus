import { z } from "zod";

export const UnitProgressSchema = z.object({
  status: z.enum(["in_progress", "completed"]),
  bestScore: z.number().min(0).max(1).nullable(),
  attempts: z.number().int().default(0),
  stepIndex: z.number().int().default(0),
  completedAt: z.string().nullable(),
});

export const ItemProgressSchema = z.object({
  seen: z.number().int().default(0),
  correct: z.number().int().default(0),
  lastCorrect: z.boolean().nullable(),
  lastSeenAt: z.string().nullable(),
});

export const ExamResultSchema = z.object({
  examId: z.string(),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  score: z.number(),
  max: z.number(),
  answers: z.record(z.string(), z.unknown()),
  byTheme: z.record(z.string(), z.array(z.number())).optional(),
});

export const ProgressSchema = z.object({
  version: z.literal(1),
  startedAt: z.string(),
  lastActivityAt: z.string(),
  lastLocation: z.object({ unitId: z.string(), stepIndex: z.number().int() }).nullable(),
  streak: z.object({ current: z.number().int(), best: z.number().int(), lastDay: z.string().nullable() }),
  dailyGoalMinutes: z.number().int(),
  minutesByDay: z.record(z.string(), z.number()),
  units: z.record(z.string(), UnitProgressSchema),
  items: z.record(z.string(), ItemProgressSchema),
  exams: z.array(ExamResultSchema),
});

export const defaultProgress = () => ({
  version: 1 as const,
  startedAt: new Date().toISOString(),
  lastActivityAt: new Date().toISOString(),
  lastLocation: null,
  streak: { current: 0, best: 0, lastDay: null },
  dailyGoalMinutes: 30,
  minutesByDay: {},
  units: {},
  items: {},
  exams: [],
});

export const SrsCardSchema = z.object({
  id: z.string(),
  refId: z.string(),
  cardType: z.enum(["meaning", "recognise", "article", "verb-forms"]),
  box: z.number().int().min(0).max(5),
  due: z.string(),
  reps: z.number().int(),
  lapses: z.number().int(),
  lastReviewedAt: z.string().nullable(),
});

export const SrsStateSchema = z.object({
  version: z.literal(1),
  cards: z.record(z.string(), SrsCardSchema),
});

export const defaultSrs = () => ({ version: 1 as const, cards: {} });

export const AttemptSchema = z.object({
  itemId: z.string(),
  exerciseType: z.string(),
  correct: z.boolean(),
  answer: z.unknown(),
  durationMs: z.number().int(),
  at: z.string().optional(),
});

export const WritingSubmissionSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  text: z.string(),
  submittedAt: z.string(),
  feedback: z.unknown().nullable(),
});

export const WritingFileSchema = z.object({
  version: z.literal(1),
  submissions: z.array(WritingSubmissionSchema),
});

export const defaultWriting = () => ({ version: 1 as const, submissions: [] });

export const SettingsSchema = z.object({
  version: z.literal(1),
  apiKey: z.string().nullable(),
  model: z.string(),
  dailyGoalMinutes: z.number().int().default(30),
  newCardsPerDay: z.number().int().default(15),
  speechRate: z.number().default(0.95),
  spellcheckWriting: z.boolean().default(false),
  theme: z.enum(["light", "dark", "system"]).default("system"),
  usage: z.object({ requests: z.number().int().default(0), inputTokens: z.number().int().default(0), outputTokens: z.number().int().default(0) }).default({
    requests: 0,
    inputTokens: 0,
    outputTokens: 0,
  }),
});

export const defaultSettings = () => ({
  version: 1 as const,
  apiKey: null,
  model: "claude-sonnet-5-5",
  dailyGoalMinutes: 30,
  newCardsPerDay: 15,
  speechRate: 0.95,
  spellcheckWriting: false,
  theme: "system" as const,
  usage: { requests: 0, inputTokens: 0, outputTokens: 0 },
});
