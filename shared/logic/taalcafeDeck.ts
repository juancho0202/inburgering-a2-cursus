import type { WritingFeedback } from "../schemas/claude.js";
import { buildSegments } from "./corrections.js";

type Correction = WritingFeedback["corrections"][number];

/**
 * The sentence deck at the end of a taalcafé word level: every sentence of the learner that got a correction comes back
 * as a card. The learner puts its words in the right order; the right order is the sentence as Claude corrected it.
 * Using the words is not enough: the learner also practises saying them right.
 */
export interface DeckCard {
  /** The learner's own sentence, as written (a hint: what went wrong). */
  original: string;
  /** The parts of `original` that were corrected, to strike through. */
  wrong: string[];
  /** The corrected sentence in words: the answer, in order. */
  tokens: string[];
  /** Claude's explanations of the corrections in this sentence. */
  explanations: string[];
}

/** A card with more words than this is cut down to the words around the correction. */
export const DECK_MAX_WORDS = 12;
/** At most this many cards: the deck is the last step of a level, not a new lesson. */
export const DECK_MAX_CARDS = 6;

interface Piece {
  original: string;
  corrected: string;
  fix?: Correction;
}

/** Cuts a message into sentences (after . ! or ?), keeping each corrected chunk whole inside its sentence. */
function sentences(text: string, corrections: Correction[]): Piece[][] {
  const out: Piece[][] = [[]];
  for (const s of buildSegments(text, corrections)) {
    if (s.kind === "fix") {
      out[out.length - 1].push({ original: s.original, corrected: s.corrected, fix: corrections[s.index] });
      continue;
    }
    // A sentence ends at . ! ? followed by a space (or a new line).
    const parts = s.text.split(/(?<=[.!?])\s+|\n+/);
    parts.forEach((p, i) => {
      if (i > 0) out.push([]);
      if (p) out[out.length - 1].push({ original: p, corrected: p });
    });
  }
  return out;
}

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean);

export function buildDeck(messages: { text: string; corrections: Correction[] }[]): DeckCard[] {
  const cards: DeckCard[] = [];
  const seen = new Set<string>();
  for (const m of messages) {
    for (const pieces of sentences(m.text, m.corrections)) {
      const fixes = pieces.filter((p) => p.fix);
      if (!fixes.length) continue;
      const corrected = pieces.map((p) => p.corrected).join("").trim();
      let tokens = words(corrected);
      // The end mark would give the last word away.
      tokens[tokens.length - 1] = tokens[tokens.length - 1]?.replace(/[.!?]+$/, "");
      tokens = tokens.filter(Boolean);
      if (tokens.length > DECK_MAX_WORDS) {
        // Keep the words around the first correction.
        const before = words(pieces.slice(0, pieces.indexOf(fixes[0])).map((p) => p.corrected).join("")).length;
        const start = Math.max(0, Math.min(before - 3, tokens.length - DECK_MAX_WORDS));
        tokens = tokens.slice(start, start + DECK_MAX_WORDS);
      }
      const key = tokens.join(" ").toLowerCase();
      if (tokens.length < 2 || seen.has(key)) continue;
      seen.add(key);
      cards.push({
        original: pieces.map((p) => p.original).join("").trim(),
        wrong: fixes.map((p) => p.original),
        tokens,
        explanations: fixes.map((p) => p.fix!.explanation),
      });
      if (cards.length === DECK_MAX_CARDS) return cards;
    }
  }
  return cards;
}

/** How many words from the start are in the right place. A wrong answer keeps these, the rest goes back. */
export function rightFromStart(answer: string[], tokens: string[]): number {
  let n = 0;
  while (n < answer.length && answer[n] === tokens[n]) n++;
  return n;
}
