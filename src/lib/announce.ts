import type { Exercise, LessonBlock, Unit } from "@shared/types";
import { PRONUNCIATIONS } from "@shared/content/pronunciations";
import { VOICES } from "@shared/content/voices";

type Step = Unit["steps"][number];

/** How Dutch says the letters, written the way a Dutch voice reads them. */
export const LETTER_NAMES: Record<string, string> = {
  a: "aa", b: "bee", c: "see", d: "dee", e: "ee", f: "ef", g: "gee", h: "haa", i: "ie", j: "jee", k: "kaa", l: "el", m: "em",
  n: "en", o: "oo", p: "pee", q: "kuu", r: "er", s: "es", t: "tee", u: "uu", v: "vee", w: "wee", x: "iks", y: "ei", z: "zet",
};

/**
 * Abbreviations that are said letter by letter (vmbo = "vee em bee oo"); a voice would read them as a word.
 * Ones said as a word (havo, DUO, NAVO, DigiD) are not here. The lower case ones match in any case; the others
 * only as written, because "OR" (ondernemingsraad) is not "or".
 */
const SPELLED_ANY_CASE = /(?<![\p{L}])(?:vmbo|mbo|hbo|vwo|wo|cv|tv|ov|bso|gft|pmd)(?![\p{L}])-?/giu;
const SPELLED_AS_WRITTEN = /(?<![\p{L}])(?:ID|OR|MR|AOW|BRP|GGD|VOC|BSN|WW|EU|EEG|IND|UWV|SVB|Wmo)(?![\p{L}])-?/gu;

/** Spell out the abbreviations that are said letter by letter ("mbo-opleiding" becomes "em bee oo opleiding"). */
export function spellAbbreviations(text: string): string {
  const spell = (m: string) =>
    [...m.replace(/-$/, "").toLowerCase()].map((c) => LETTER_NAMES[c]).join(" ") + (m.endsWith("-") ? " " : "");
  return text.replace(SPELLED_ANY_CASE, spell).replace(SPELLED_AS_WRITTEN, spell);
}

/**
 * Lines that are layout, not words: markdown table rows (a voice reads the pipes) and rules.
 * Tables are never read aloud; the page shows them and the words in them have their own 🔊 buttons.
 */
const SILENT_LINE = /^\s*(?:\|.*|(?:[-*]\s*){3,}|```.*)$/;

const UNITS = ["nul", "een", "twee", "drie", "vier", "vijf", "zes", "zeven", "acht", "negen"];
const TEENS = ["tien", "elf", "twaalf", "dertien", "veertien", "vijftien", "zestien", "zeventien", "achttien", "negentien"];
const TENS = ["", "", "twintig", "dertig", "veertig", "vijftig", "zestig", "zeventig", "tachtig", "negentig"];

/** A number (0 to 9999) in Dutch words: 21 is "eenentwintig", 1945 "duizend negenhonderdvijfenveertig". */
export function dutchNumber(n: number): string {
  if (n < 10) return UNITS[n];
  if (n < 20) return TEENS[n - 10];
  if (n < 100) {
    const unit = UNITS[n % 10];
    // tweeëntwintig: the trema keeps "ee" and "en" apart
    return n % 10 ? `${unit}${unit.endsWith("e") ? "ën" : "en"}${TENS[Math.floor(n / 10)]}` : TENS[n / 10];
  }
  const [size, word] = n < 1000 ? [100, "honderd"] : [1000, "duizend "];
  const count = Math.floor(n / size);
  const rest = n % size;
  return `${count === 1 ? "" : dutchNumber(count)}${word}${rest ? dutchNumber(rest) : ""}`.trim();
}

/** "16e" is "zestiende": espeak says "zestiende ee". */
export function dutchOrdinal(n: number): string {
  const rest = n % 100;
  if (rest === 0 || rest >= 20) return `${dutchNumber(n)}ste`;
  const head = n - rest ? dutchNumber(n - rest) : "";
  const small = ({ 1: "eerste", 2: "tweede", 3: "derde", 8: "achtste" } as Record<number, string>)[rest] ?? `${dutchNumber(rest)}de`;
  return `${head}${small}`;
}

/** "1) aanhef; 2) …" are numbered points, said "1: aanhef; 2: …"; a ")" that closes a "(" stays a bracket. */
function numberedPoints(text: string): string {
  let open = 0;
  return text.replace(/\(|(?<!\d)(\d{1,2})\)|\)/g, (sign, n?: string) => {
    if (sign === "(") open++;
    else if (open > 0) open--;
    else if (n) return `${n}:`;
    return sign;
  });
}

const euro = (_: string, euros: string, cents?: string) =>
  euros === "0" && cents && cents !== "-" ? `${Number(cents)} cent` : `${euros} euro${cents && cents !== "-" && cents !== "00" ? ` ${Number(cents)}` : ""}`;

/**
 * Signs as the words a teacher says. Unhandled, the voice reads them by name ("pijl naar rechts", "slash",
 * "gelijkteken") or runs on without a pause ("·", brackets). tests/unit/voice-text.test.ts fails when the course
 * uses a sign that is not handled here.
 */
function saySigns(text: string): string {
  return (
    numberedPoints(text)
      .replace(/€\s?(\d+)(?:,(\d{2}|-))?/g, euro)
      .replace(/(\d)\s*–\s*(?=\d)/g, "$1 tot ")
      .replace(/\s*[–—]\s*/g, ", ")
      .replace(/(?<![\p{L}\p{N}])(\d{1,4})(?:e|de|ste)(?![\p{L}\p{N}])/gu, (_, n: string) => dutchOrdinal(Number(n)))
      .replace(/\s*≠\s*/g, " is niet ")
      .replace(/\s*=\s*/g, " is ")
      .replace(/\s*\+\s*/g, " plus ")
      .replace(/\s*→\s*/g, ", ")
      .replace(/\s*·\s*/g, ". ")
      .replace(/(?<=\p{L})\s*\/\s*(?=\p{L})/gu, " of ")
      .replace(/\s*%/g, " procent")
      .replace(/\s*&\s*/g, " en ")
      // a picture (☰, an emoji) is shown, not read
      .replace(/\p{Extended_Pictographic}|[\u2630-\u2637]\uFE0F?/gu, "")
      // a bracket is a pause
      .replace(/\s*[()]\s*/g, ", ")
      // tidy the pauses: one sign at a time, none at the start or the end
      .replace(/\s+([,.!?:;])/g, "$1")
      .replace(/,+/g, ",")
      .replace(/,\s*(?=[.!?:;])/g, "")
      .replace(/([.!?:;…])\s*,/g, "$1")
      .replace(/([!?…:;])\s*\./g, "$1")
      .replace(/\.\s+\./g, ".")
      .replace(/^\s*,\s*|\s*,\s*$/g, "")
  );
}

/** Turn course text (markdown, gaps, lists, signs) into something that reads well aloud. */
export function speakable(text: string): string {
  return saySigns(
    spellAbbreviations(text)
      .split(/\n+/)
      .filter((line) => !SILENT_LINE.test(line))
      // A list item or line without its own full stop still needs a pause.
      .map((line) => line.replace(/^\s*(?:[-•]|\d+\.)\s+/, "").trim())
      .filter(Boolean)
      .map((line, i, all) => (i < all.length - 1 && !/[.!?:;…]$/.test(line.replace(/[*_]+$/, "")) ? `${line}.` : line))
      .join(" ")
      .replace(/_{2,}/g, " … ")
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_`#>~]/g, "")
      .replace(/\|/g, " ")
      .replace(/\s+/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

/** Words in PRONUNCIATIONS, as whole words or word parts ("-tje", "ge-"), longest first so "-etje" wins over "-tje". */
const PRONOUNCED = new RegExp(
  `(?<![\\p{L}\\p{N}-])(?:${Object.keys(PRONUNCIATIONS)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("|")})(?![\\p{L}\\p{N}-])`,
  "giu",
);

/**
 * What the recorded voice (Piper) is given: the speakable text, with the words espeak says wrong as phonemes in
 * Piper's [[ ]] (see shared/content/pronunciations.ts). The device's own voice gets speakable() instead.
 */
export function voiceInput(text: string): string {
  const said = speakable(text);
  // with no pronunciations the pattern would be empty and match between every two letters
  return Object.keys(PRONUNCIATIONS).length ? said.replace(PRONOUNCED, (word) => `[[${PRONUNCIATIONS[word.toLowerCase()]}]]`) : said;
}

/**
 * The voices of the recorded clips (Piper models, see scripts/tts). Lessons take turns by their number in the module:
 * lesson 1 the first voice, lesson 2 the second, lesson 4 the first again, … the same in every module.
 */
export const LESSON_VOICES: { id: string; model: string; speaker?: number }[] = [...VOICES];
export const lessonVoice = (lessonNumber = 1) => LESSON_VOICES[(lessonNumber - 1) % LESSON_VOICES.length].id;

/**
 * File name of the recorded clip for a text in a voice (FNV-1a of both): the same in the generator and the app.
 * It hashes what the voice is given, so a line is recorded again when its words or their pronunciation change.
 */
export function voiceKey(text: string, voice: string): string {
  let h = 0x811c9dc5;
  for (const ch of `${voice}\n${voiceInput(text)}`) {
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

/** The same title said aloud: case, punctuation and spacing are not heard ("De of het" and "De of het?"). */
function sameTitle(a: string, b: string): boolean {
  const said = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
  return said(a) === said(b);
}

/**
 * What the voice says when a step appears. The first step also names the lesson ("Les 3. De of het."), and leaves
 * out its own title when that is the lesson's name again.
 * An exercise with the same instruction as `previousPrompt` (the exercise just before) doesn't repeat it.
 */
export function stepAnnouncement(step: Step, opts: { first: boolean; unitTitle: string; lessonNumber?: number; previousPrompt?: string }): string {
  const body =
    step.type === "lesson" ? step.title : exerciseAnnouncement(step.exercise, step.exercise.prompt !== opts.previousPrompt);
  if (!opts.first) return body;
  const intro = opts.lessonNumber ? `Les ${opts.lessonNumber}. ${opts.unitTitle}.` : `${opts.unitTitle}.`;
  return step.type === "lesson" && sameTitle(step.title, opts.unitTitle) ? intro : `${intro} ${body}`;
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
