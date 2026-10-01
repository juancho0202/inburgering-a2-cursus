import { z } from "zod";
import {
  CourseSchema,
  ModuleSchema,
  UnitSchema,
  StepSchema,
  VocabEntrySchema,
  VocabFileSchema,
  VerbEntrySchema,
  ExamSchema,
} from "./schemas/content.js";
import type { Exercise, LessonBlock } from "./schemas/content.js";
import {
  ProgressSchema,
  UnitProgressSchema,
  ItemProgressSchema,
  SrsCardSchema,
  SrsStateSchema,
  AttemptSchema,
  WritingSubmissionSchema,
  SettingsSchema,
} from "./schemas/progress.js";

export type Course = z.infer<typeof CourseSchema>;
export type ModuleDef = z.infer<typeof ModuleSchema>;
export type Unit = z.infer<typeof UnitSchema>;
export type { Exercise, LessonBlock };
export type Step = z.infer<typeof StepSchema>;
export type VocabEntry = z.infer<typeof VocabEntrySchema>;
export type VocabFile = z.infer<typeof VocabFileSchema>;
export type VerbEntry = z.infer<typeof VerbEntrySchema>;
export type Exam = z.infer<typeof ExamSchema>;

export type Progress = z.infer<typeof ProgressSchema>;
export type UnitProgress = z.infer<typeof UnitProgressSchema>;
export type ItemProgress = z.infer<typeof ItemProgressSchema>;
export type SrsCard = z.infer<typeof SrsCardSchema>;
export type SrsState = z.infer<typeof SrsStateSchema>;
export type Attempt = z.infer<typeof AttemptSchema>;
export type WritingSubmission = z.infer<typeof WritingSubmissionSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
