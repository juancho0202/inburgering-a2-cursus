/**
 * Lists every line the voice can say in a lesson, for scripts/tts/generate.py.
 * Writes .tts/texts.json: [{ key, text, model, speaker }], where key is the clip's file name (see voiceKey)
 * and model/speaker the Piper voice of the lesson (see LESSON_VOICES).
 */
import fs from "node:fs/promises";
import { loadCourse } from "../courseFiles.js";
import { LESSON_DONE, LESSON_VOICES, lessonVoice, speakable, stepSegments, voiceKey } from "../../src/lib/announce.js";

const { content } = await loadCourse();
const texts = new Map<string, { text: string; voice: string }>();
const add = (t: string, voice: string) => {
  const text = speakable(t);
  if (!text) return;
  const key = voiceKey(text, voice);
  const other = texts.get(key);
  if (other && (other.text !== text || other.voice !== voice)) throw new Error(`Two lines share the clip name ${key}: "${other.text}" / "${text}"`);
  texts.set(key, { text, voice });
};

for (const mod of content.modules.values()) {
  mod.units.forEach((unitId, i) => {
    const unit = content.units.get(unitId);
    if (!unit) return;
    const voice = lessonVoice(i + 1);
    unit.steps.forEach((step, si) => {
      const opts = { unitTitle: unit.title, lessonNumber: i + 1, goal: si === 0 ? unit.goal : undefined };
      // Step 1 opens with the lesson's name; going back to it later does not.
      for (const first of si === 0 ? [false, true] : [false]) stepSegments(step, { ...opts, first }).forEach((seg) => add(seg.text, voice));
    });
  });
}
for (const v of LESSON_VOICES) Object.values(LESSON_DONE).forEach((t) => add(t, v.id));

await fs.mkdir(".tts", { recursive: true });
const lines = [...texts].map(([key, { text, voice }]) => {
  const v = LESSON_VOICES.find((x) => x.id === voice)!;
  return { key, text, model: v.model, speaker: v.speaker ?? null };
});
await fs.writeFile(".tts/texts.json", JSON.stringify(lines, null, 1));
console.log(`${texts.size} lines → .tts/texts.json`);
