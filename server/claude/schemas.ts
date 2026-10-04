/**
 * JSON schemas for structured outputs. Every object has additionalProperties: false and
 * lists all its properties in `required`. Number ranges are checked later with zod.
 */
const str = { type: "string" } as const;
const strArray = { type: "array", items: str } as const;

export const writingFeedbackJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["overall", "score", "criteria", "missingPoints", "corrections", "correctedText", "strongPoints", "nextTip"],
  properties: {
    overall: { type: "string", enum: ["voldoende", "bijna", "onvoldoende"] },
    score: { type: "number" },
    criteria: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "score", "comment"],
        properties: { name: str, score: { type: "number" }, comment: str },
      },
    },
    missingPoints: strArray,
    corrections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["original", "corrected", "type", "explanation"],
        properties: {
          original: str,
          corrected: str,
          type: { type: "string", enum: ["woordvolgorde", "werkwoord", "spelling", "lidwoord", "woordkeuze", "hoofdletter/leesteken", "anders"] },
          explanation: str,
        },
      },
    },
    correctedText: str,
    strongPoints: strArray,
    nextTip: str,
  },
} as const;

export const explanationJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["explanation", "rule", "extraExamples"],
  properties: {
    explanation: str,
    rule: { anyOf: [str, { type: "null" }] },
    extraExamples: strArray,
  },
} as const;

const mcQuestion = {
  type: "object",
  additionalProperties: false,
  required: ["prompt", "options", "answer", "explanation"],
  properties: { prompt: str, options: strArray, answer: { type: "integer" }, explanation: str },
} as const;

const wrap = (item: object) => ({
  type: "object",
  additionalProperties: false,
  required: ["exercises"],
  properties: { exercises: { type: "array", items: item } },
});

export const generateJsonSchemas = {
  mc: wrap(mcQuestion),
  "gap-fill": wrap({
    type: "object",
    additionalProperties: false,
    required: ["prompt", "text", "answers", "explanation"],
    properties: { prompt: str, text: str, answers: { type: "array", items: strArray }, explanation: str },
  }),
  "word-order": wrap({
    type: "object",
    additionalProperties: false,
    required: ["prompt", "tokens", "explanation"],
    properties: { prompt: str, tokens: strArray, explanation: str },
  }),
  reading: wrap({
    type: "object",
    additionalProperties: false,
    required: ["prompt", "docType", "title", "body", "questions", "explanation"],
    properties: {
      prompt: str,
      docType: { type: "string", enum: ["brief", "email", "advertentie", "formulier", "bericht", "rooster", "folder"] },
      title: str,
      body: str,
      questions: { type: "array", items: mcQuestion },
      explanation: str,
    },
  }),
} as const;
