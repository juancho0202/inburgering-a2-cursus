/**
 * The recorded voices (Piper models, see scripts/tts/README.md). They read the lessons, taking turns by lesson
 * number, and they play the people in listening fragments. nathalie (Flemish) is the only female Dutch voice.
 */
export const VOICES = [
  { id: "ronnie", model: "nl_NL-ronnie-medium" },
  { id: "alex", model: "nl_NL-alex-medium" },
  { id: "nathalie", model: "nl_BE-nathalie-medium" },
] as const;

export type VoiceId = (typeof VOICES)[number]["id"];
export const VOICE_IDS = VOICES.map((v) => v.id) as [VoiceId, ...VoiceId[]];
