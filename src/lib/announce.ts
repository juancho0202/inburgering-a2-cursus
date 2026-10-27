import type { Exercise, LessonBlock, Unit } from "@shared/types";
import { VOICES } from "@shared/content/voices";

type Step = Unit["steps"][number];

/** Turn course text (markdown, gaps, lists) into something that reads well aloud. */
export function speakable(text: string): string {
  return text
    .split(/\n+/)
    // A list item or line without its own full stop still needs a pause.
    .map((line) => line.replace(/^\s*(?:[-•]|\d+\.)\s+/, "").trim())
    .filter(Boolean)
    .map((line, i, all) => (i < all.length - 1 && !/[.!?:;…]$/.test(line.replace(/[*_]+$/, "")) ? `${line}.` : line))
    .join(" ")
    .replace(/_{2,}/g, " … ")
    .replace(/[*_`#>]/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * The voices of the recorded clips (Piper models, see scripts/tts). Lessons take turns by their number in the module:
 * lesson 1 the first voice, lesson 2 the second, lesson 4 the first again, … the same in every module.
 */
export const LESSON_VOICES: { id: string; model: string; speaker?: number }[] = [...VOICES];
export const lessonVoice = (lessonNumber = 1) => LESSON_VOICES[(lessonNumber - 1) % LESSON_VOICES.length].id;

/** File name of the recorded clip for a text in a voice (FNV-1a of both): the same in the generator and the app. */
export function voiceKey(text: string, voice: string): string {
  let h = 0x811c9dc5;
  for (const ch of `${voice}\n${speakable(text)}`) {
    h ^= ch.codePointAt(0)!;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Fixed lines spoken outside the steps. */
export const LESSON_DONE = { passed: "Les klaar! Goed gedaan.", failed: "Les klaar! Probeer het nog een keer." };

/**
 * What the voice says for an exercise: the question, plus the sentence or statement it is about.
 * A gap with a choice list is just the question: read aloud, the sentence around the gap makes no sense.
 * Without the prompt (the same instruction as the exercise before) only that sentence or statement is left.
 */
export function exerciseAnnouncement(e: Exercise, withPrompt = true): string {
  const prompt = withPrompt ? e.prompt : "";
  if (e.type === "true-false") return `${prompt} ${e.statement}`.trim();
  if (e.type === "gap-fill") return `${prompt} ${e.text}`.trim();
  return prompt;
}

/**
 * What the voice says when a step appears. The first step also names the lesson ("Les 3. De of het.").
 * An exercise with the same instruction as `previousPrompt` (the exercise just before) doesn't repeat it.
 */
export function stepAnnouncement(step: Step, opts: { first: boolean; unitTitle: string; lessonNumber?: number; previousPrompt?: string }): string {
  const body =
    step.type === "lesson" ? step.title : exerciseAnnouncement(step.exercise, step.exercise.prompt !== opts.previousPrompt);
  if (!opts.first) return body;
  const intro = opts.lessonNumber ? `Les ${opts.lessonNumber}. ${opts.unitTitle}.` : `${opts.unitTitle}.`;
  return step.type === "lesson" && step.title === opts.unitTitle ? intro : `${intro} ${body}`;
}

/** One piece the voice reads, with the id of the part of the page it belongs to (for highlighting). */
export interface Segment {
  id: string;
  text: string;
}

/** What the voice reads of a lesson block. Tables and word cards are skipped: the words have their own 🔊 buttons. */
export function blockText(b: LessonBlock): string {
  switch (b.kind) {
    case "text":
      return b.md;
    case "tip":
      return `Tip: ${b.md}`;
    case "example":
      return b.nl;
    case "dialogue":
      return b.lines.map((l) => l.nl).join("\n");
    case "document":
      return `${b.title}\n${b.body}`;
    default:
      return "";
  }
}

/**
 * Everything the voice reads for a step, in order: the heading (on the first step with the lesson's name),
 * then for a listening exercise what there is to hear ("listen"), for a listening fragment who is talking where
 * ("situation"; the fragment itself is its own recording), or for a lesson the goal on step 1
 * and each readable block (ids "block-0", "block-1", …).
 */
export function stepSegments(
  step: Step,
  opts: { first: boolean; unitTitle: string; lessonNumber?: number; goal?: string; previousPrompt?: string },
): Segment[] {
  const heading = stepAnnouncement(step, opts);
  const segments: Segment[] = heading ? [{ id: "heading", text: heading }] : [];
  // A listening task: after the question, the voice says what the learner has to listen to.
  if (step.type === "exercise" && step.exercise.listen) segments.push({ id: "listen", text: step.exercise.listen });
  if (step.type === "exercise" && step.exercise.type === "listening") segments.push({ id: "situation", text: step.exercise.fragment.situation });
  if (step.type !== "lesson") return segments;
  if (opts.goal) segments.push({ id: "goal", text: opts.goal });
  step.blocks.forEach((b, i) => {
    const text = blockText(b);
    if (speakable(text)) segments.push({ id: `block-${i}`, text });
  });
  return segments;
}
