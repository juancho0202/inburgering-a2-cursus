import { z } from "zod";
import { ExerciseSchema } from "./content.js";

export const CORRECTION_TYPES = [
  "woordvolgorde",
  "werkwoord",
  "spelling",
  "lidwoord",
  "woordkeuze",
  "hoofdletter/leesteken",
  "anders",
] as const;
export type CorrectionType = (typeof CORRECTION_TYPES)[number];

export const WritingFeedbackSchema = z.object({
  overall: z.enum(["voldoende", "bijna", "onvoldoende"]),
  score: z.number().min(0).max(10),
  criteria: z.array(z.object({ name: z.string(), score: z.number().min(0).max(3), comment: z.string() })),
  missingPoints: z.array(z.string()),
  corrections: z.array(
    z.object({
      original: z.string(),
      corrected: z.string(),
      type: z.enum(CORRECTION_TYPES),
      explanation: z.string(),
    }),
  ),
  correctedText: z.string(),
  strongPoints: z.array(z.string()),
  nextTip: z.string(),
});
export type WritingFeedback = z.infer<typeof WritingFeedbackSchema>;

export const ExplanationSchema = z.object({
  explanation: z.string(),
  rule: z.string().nullable(),
  extraExamples: z.array(z.string()).max(3),
});
export type Explanation = z.infer<typeof ExplanationSchema>;

export const GENERATE_TYPES = ["mc", "gap-fill", "word-order", "reading"] as const;

export const GenerateRequestSchema = z
  .object({
    unitId: z.string().optional(),
    tag: z.string().optional(),
    type: z.enum(GENERATE_TYPES),
    count: z.number().int().min(5).max(10),
  })
  .refine((v) => !!v.unitId !== !!v.tag, { message: "Geef een unitId of een tag." });
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export const GeneratedItemSchema = z.object({
  exercise: ExerciseSchema,
  source: z.literal("generated"),
  hidden: z.boolean().default(false),
  createdAt: z.string(),
});
export const GeneratedFileSchema = z.object({
  unitId: z.string(),
  items: z.array(GeneratedItemSchema),
});
export type GeneratedItem = z.infer<typeof GeneratedItemSchema>;
export type GeneratedFile = z.infer<typeof GeneratedFileSchema>;

export const ExplanationsFileSchema = z.object({
  version: z.literal(1),
  entries: z.record(z.string(), ExplanationSchema),
});
export const defaultExplanations = () => ({ version: 1 as const, entries: {} as Record<string, Explanation> });
