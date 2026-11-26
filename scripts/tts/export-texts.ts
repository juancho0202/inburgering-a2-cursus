/**
 * Lists every line the voice can say in a lesson, and every listening fragment, for scripts/tts/generate.py.
 * Writes .tts/texts.json: [{ key, text, input, model, speaker }], where key is the clip's file name (see voiceKey),
 * input what Piper is given (the text with [[phonemes]] for the words in PRONUNCIATIONS, see voiceInput) and
 * model/speaker the Piper voice of the lesson (see LESSON_VOICES),
 * and .tts/fragments.json: [{ key, kind, lines: [{ text, input?, model, phone }] }] (see fragmentRecording),
 * and .tts/pronunciations.json, the lists the pronunciation check needs (shared/content/pronunciations.ts).
 */
import fs from "node:fs/promises";
import { loadCourse } from "../courseFiles.js";
import { LESSON_VOICES, LETTER_NAMES } from "../../src/lib/announce.js";
import { ESPEAK_IS_RIGHT, HEARD_RIGHT, PRONUNCIATIONS } from "../../shared/content/pronunciations.js";
import { spokenLines } from "./lines.js";

const { content } = await loadCourse();
const { texts, fragments } = spokenLines(content);

await fs.mkdir(".tts", { recursive: true });
const lines = [...texts].map(([key, { text, input, voice }]) => {
  const v = LESSON_VOICES.find((x) => x.id === voice)!;
  return { key, text, input, model: v.model, speaker: v.speaker ?? null };
});
await fs.writeFile(".tts/texts.json", JSON.stringify(lines, null, 1));
await fs.writeFile(".tts/fragments.json", JSON.stringify([...fragments].map(([key, f]) => ({ key, ...f })), null, 1));
await fs.writeFile(
  ".tts/pronunciations.json",
  JSON.stringify(
    {
      pronunciations: PRONUNCIATIONS,
      espeakIsRight: ESPEAK_IS_RIGHT,
      // by Piper model, which is what the generator knows a line by
      heardRight: Object.fromEntries(LESSON_VOICES.map((v) => [v.model, HEARD_RIGHT[v.id] ?? []])),
      letterNames: [...new Set(Object.values(LETTER_NAMES))],
    },
    null,
    1,
  ),
);
console.log(`${texts.size} lines → .tts/texts.json, ${fragments.size} fragments → .tts/fragments.json`);
