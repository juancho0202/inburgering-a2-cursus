/**
 * Every line the voice can say in a lesson, and every listening fragment: what scripts/tts records (export-texts.ts),
 * and what tests/unit/voice-recordings.test.ts expects a recording of.
 */
import type { Exercise, Fragment } from "@shared/types";
import type { Content } from "@shared/content/types";
import { LESSON_DONE, LESSON_VOICES, lessonVoice, speakable, stepSegments, voiceKey } from "../../src/lib/announce.js";
import { fragmentKey, fragmentRecording, type FragmentRecording } from "../../src/lib/fragments.js";

/** The lines by clip name (see voiceKey), with the voice that says them, and the fragments by fragmentKey. */
export function spokenLines(content: Content) {
  const texts = new Map<string, { text: string; voice: string }>();
  const add = (t: string, voice: string) => {
    const text = speakable(t);
    if (!text) return;
    const key = voiceKey(text, voice);
    const other = texts.get(key);
    if (other && (other.text !== text || other.voice !== voice)) throw new Error(`Two lines share the clip name ${key}: "${other.text}" / "${text}"`);
    texts.set(key, { text, voice });
  };

  const fragments = new Map<string, FragmentRecording>();
  const addFragment = (f: Fragment) => fragments.set(fragmentKey(f), fragmentRecording(f));
  /** A listening exercise: its fragment, and its questions (each has a 🔊 button) in the voice of the lesson. */
  const addListening = (ex: Exercise, voice: string) => {
    if (ex.type !== "listening") return;
    addFragment(ex.fragment);
    for (const q of ex.questions) add(q.prompt, voice);
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
        if (step.type === "exercise") addListening(step.exercise, voice);
        else for (const b of step.blocks) if (b.kind === "fragment") addFragment(b.fragment);
      });
    });
  }
  for (const v of LESSON_VOICES) Object.values(LESSON_DONE).forEach((t) => add(t, v.id));
  // Exams have no lesson number: their questions are read by the first voice (ExamView uses it).
  for (const exam of content.exams.values()) for (const item of exam.items) if ("type" in item) addListening(item, LESSON_VOICES[0].id);

  return { texts, fragments };
}
