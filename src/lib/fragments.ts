import type { Fragment } from "@shared/schemas/content";
import { hashString } from "@shared/content/data";
import { VOICES } from "@shared/content/voices";
import { speakable, voiceInput } from "./announce";

/**
 * What a fragment sounds like, which is all scripts/tts needs to record it: the kind and each line with its voice.
 * `input` is what Piper is given when it differs from the text (a word from PRONUNCIATIONS, see voiceInput), so a
 * fragment is recorded again when a pronunciation it uses changes.
 */
export interface FragmentRecording {
  kind: Fragment["kind"];
  lines: { text: string; input?: string; model: string; phone: boolean }[];
}

export function fragmentRecording(f: Fragment): FragmentRecording {
  const speakers = new Map(f.speakers.map((s) => [s.name, s]));
  return {
    kind: f.kind,
    lines: f.lines.map((l) => {
      const s = speakers.get(l.speaker);
      const model = VOICES.find((v) => v.id === s?.voice)?.model ?? VOICES[0].model;
      const text = speakable(l.nl);
      const input = voiceInput(l.nl);
      return { text, ...(input !== text && { input }), model, phone: f.kind === "voicemail" || s?.phone === true };
    }),
  };
}

/**
 * File name of a fragment's recording (the same in the generator and the app). It changes when what you hear
 * changes, not when only the situation or a speaker's name does.
 */
export const fragmentKey = (f: Fragment): string => hashString(JSON.stringify(fragmentRecording(f)));

/** How each kind of fragment is named on screen. */
export const FRAGMENT_LABEL: Record<Fragment["kind"], { icon: string; label: string }> = {
  gesprek: { icon: "💬", label: "Gesprek" },
  telefoon: { icon: "📞", label: "Telefoongesprek" },
  voicemail: { icon: "📱", label: "Voicemail" },
  omroep: { icon: "📢", label: "Omroepbericht" },
  radio: { icon: "📻", label: "Radio" },
  uitleg: { icon: "🧑‍🏫", label: "Uitleg" },
};
