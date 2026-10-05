import { z } from "zod";
import {
  AttemptRecordSchema,
  ExamRecordSchema,
  ExplanationRecordSchema,
  FlagRecordSchema,
  GeneratedRecordSchema,
  LastLocationSchema,
  NewTodaySchema,
  SettingsRecordSchema,
  SrsCardRecordSchema,
  UnitRecordSchema,
  WritingRecordSchema,
} from "./store.js";

/** The data part of a progress file. Also used for the safety copy that makes "undo last import" possible. */
export const ProgressDataSchema = z.object({
  attempts: z.array(AttemptRecordSchema),
  units: z.array(UnitRecordSchema),
  srsCards: z.array(SrsCardRecordSchema),
  writing: z.array(WritingRecordSchema),
  examResults: z.array(ExamRecordSchema),
  explanations: z.array(ExplanationRecordSchema),
  generated: z.array(GeneratedRecordSchema),
  flags: z.array(FlagRecordSchema),
  settings: SettingsRecordSchema.nullable(),
  lastLocation: LastLocationSchema.nullable(),
  srsNewToday: NewTodaySchema.nullable(),
});
export type ProgressData = z.infer<typeof ProgressDataSchema>;

export const PROGRESS_FILE_FORMAT = "inburgering-a2-progress";
export const PROGRESS_FILE_VERSION = 2;

/** The progress file. It never contains the API key (the key is not part of the data store). */
export const ProgressFileSchema = z.object({
  format: z.literal(PROGRESS_FILE_FORMAT),
  version: z.literal(PROGRESS_FILE_VERSION),
  exportedAt: z.string(),
  device: z.object({ id: z.string(), name: z.string().nullable() }),
  contentVersion: z.string(),
  data: ProgressDataSchema,
});
export type ProgressFile = z.infer<typeof ProgressFileSchema>;

export const emptyProgressData = (): ProgressData => ({
  attempts: [],
  units: [],
  srsCards: [],
  writing: [],
  examResults: [],
  explanations: [],
  generated: [],
  flags: [],
  settings: null,
  lastLocation: null,
  srsNewToday: null,
});
