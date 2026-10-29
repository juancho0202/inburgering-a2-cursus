/**
 * Lists every line the voice can say in a lesson, and every listening fragment, for scripts/tts/generate.py.
 * Writes .tts/texts.json: [{ key, text, model, speaker }], where key is the clip's file name (see voiceKey)
 * and model/speaker the Piper voice of the lesson (see LESSON_VOICES),
 * and .tts/fragments.json: [{ key, kind, lines: [{ text, model, phone }] }] (see fragmentRecording).
 */
import fs from "node:fs/promises";
import { loadCourse } from "../courseFiles.js";
import { LESSON_VOICES } from "../../src/lib/announce.js";
import { spokenLines } from "./lines.js";

const { content } = await loadCourse();
const { texts, fragments } = spokenLines(content);

await fs.mkdir(".tts", { recursive: true });
const lines = [...texts].map(([key, { text, voice }]) => {
  const v = LESSON_VOICES.find((x) => x.id === voice)!;
  return { key, text, model: v.model, speaker: v.speaker ?? null };
});
await fs.writeFile(".tts/texts.json", JSON.stringify(lines, null, 1));
await fs.writeFile(".tts/fragments.json", JSON.stringify([...fragments].map(([key, f]) => ({ key, ...f })), null, 1));
console.log(`${texts.size} lines → .tts/texts.json, ${fragments.size} fragments → .tts/fragments.json`);
