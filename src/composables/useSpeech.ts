import { computed, ref } from "vue";
import { useSettingsStore } from "../stores/settings";
import { LESSON_VOICES, speakable, voiceKey, type Segment } from "../lib/announce";

const voice = ref<SpeechSynthesisVoice | null>(null);
const ready = ref(false);

/**
 * Higher is better. The "Premium"/"Enhanced"/"Natural" voices (macOS, iOS, Windows, Edge) sound far more natural
 * than the default ones. Online voices (e.g. Chrome's "Google Nederlands") come next; they are run by the browser maker.
 */
function rank(v: SpeechSynthesisVoice): number {
  let score = v.lang === "nl-NL" || v.lang === "nl_NL" ? 2 : 0;
  if (/premium|enhanced|natural|neural|verbeterd/i.test(v.name)) score += 8;
  else if (!v.localService) score += 4;
  return score;
}

function pickVoice() {
  if (typeof speechSynthesis === "undefined") return;
  const dutch = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith("nl"));
  voice.value = dutch.sort((a, b) => rank(b) - rank(a))[0] ?? null;
  ready.value = true;
}

if (typeof speechSynthesis !== "undefined") {
  pickVoice();
  speechSynthesis.addEventListener?.("voiceschanged", pickVoice);
}

// ----- recorded voice (scripts/tts) -----
const VOICE_DIR = "/audio/voice";
let recorded: Promise<Set<string>> | null = null;
/** The clips that were recorded for this version of the course; none when there are none. */
function recordedClips(): Promise<Set<string>> {
  recorded ??= fetch(`${VOICE_DIR}/manifest.json`)
    .then((r) => (r.ok ? r.json() : { keys: [] }))
    .then((m: { keys: string[] }) => new Set(m.keys))
    .catch(() => new Set<string>());
  return recorded;
}

/** The recorded voice in use: each lesson has its own (see lessonVoice). */
const currentVoice = ref(LESSON_VOICES[0].id);
if (typeof fetch !== "undefined" && typeof Audio !== "undefined") void recordedClips();

let pending: ReturnType<typeof setTimeout> | null = null;
let clip: HTMLAudioElement | null = null;
/** Ends the line being spoken (so a stopped read-along does not wait forever). */
let finishLine: (() => void) | null = null;
/** Bumped on every stop, so a clip lookup or reading that finishes late does not talk over the next step. */
let generation = 0;

/** The read-along: whether it is reading, and which segment (its id) is being read. */
const reading = ref(false);
const activeId = ref<string | null>(null);

/** Another sound that plays now (a listening fragment): it stops whenever the voice stops or starts. */
let otherSound: (() => void) | null = null;

/** Start another sound: stops the voice (and any other such sound); `stop` is called when something else starts. */
export function claimSound(stop: () => void) {
  stopSpeech();
  otherSound = stop;
}
/** That sound ended by itself. */
export function releaseSound(stop: () => void) {
  if (otherSound === stop) otherSound = null;
}

export function stopSpeech() {
  const other = otherSound;
  otherSound = null;
  other?.();
  generation++;
  if (pending) clearTimeout(pending);
  pending = null;
  clip?.pause();
  clip = null;
  if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  finishLine?.();
  finishLine = null;
  reading.value = false;
  activeId.value = null;
}

/**
 * Say a line with the device's own voice (for listening fragments that have no recording). `pitch` tells the
 * people in a conversation apart. Resolves when it has been said or was stopped; false when there is no voice.
 */
export function sayWithDevice(text: string, opts: { pitch?: number; rate?: number } = {}): Promise<boolean> {
  if (!voice.value) pickVoice(); // the voices can arrive after the page loaded
  if (typeof speechSynthesis === "undefined" || !voice.value) return Promise.resolve(false);
  return new Promise((done) => {
    const u = new SpeechSynthesisUtterance(speakable(text));
    u.lang = "nl-NL";
    u.voice = voice.value;
    u.pitch = opts.pitch ?? 1;
    u.rate = opts.rate ?? 0.95;
    u.onend = u.onerror = () => done(true);
    speechSynthesis.speak(u);
  });
}

export function useSpeech() {
  const settings = useSettingsStore();
  const available = computed(() => voice.value !== null);

  /** Say one line: the recorded clip if there is one, else the device's voice. Resolves when it has been said. */
  async function sayLine(text: string, mine: number): Promise<void> {
    const key = voiceKey(text, currentVoice.value);
    const rec = typeof Audio !== "undefined" ? await recordedClips() : null;
    if (mine !== generation) return;
    await new Promise<void>((done) => {
      finishLine = done;
      const synth = () => {
        if (!voice.value) return done();
        const u = new SpeechSynthesisUtterance(speakable(text));
        u.lang = "nl-NL";
        u.voice = voice.value;
        u.rate = settings.settings?.speechRate ?? 0.95;
        u.onend = u.onerror = () => done();
        speechSynthesis.speak(u);
      };
      if (!rec?.has(key)) return synth();
      clip = new Audio(`${VOICE_DIR}/${key}.m4a`);
      // The clips are recorded at a natural pace; the speed setting (default 0.95) is relative to that.
      clip.playbackRate = (settings.settings?.speechRate ?? 0.95) / 0.95;
      clip.onended = () => done();
      clip.onerror = () => synth();
      clip.play().catch(synth);
    });
    finishLine = null;
  }

  /** Say a single word or sentence (the 🔊 buttons). Stops any read-along. */
  function speak(text: string) {
    stopSpeech();
    void sayLine(text, generation);
  }

  /**
   * Read segments one after another, from segment `from`, optionally after a delay (e.g. the lesson tune).
   * Resolves with the index it stopped at, or the number of segments when it read everything.
   */
  async function read(segments: Segment[], opts: { from?: number; delayMs?: number } = {}): Promise<number> {
    stopSpeech();
    const mine = generation;
    reading.value = true;
    if (opts.delayMs) {
      await new Promise<void>((r) => {
        pending = setTimeout(r, opts.delayMs);
        finishLine = r;
      });
      finishLine = null;
      if (mine !== generation) return opts.from ?? 0;
    }
    let i = opts.from ?? 0;
    for (; i < segments.length && mine === generation; i++) {
      activeId.value = segments[i].id;
      await sayLine(segments[i].text, mine);
      if (mine !== generation) return i;
    }
    reading.value = false;
    activeId.value = null;
    return i;
  }

  /** Read a step aloud automatically, when announcements are on. */
  function announce(segments: Segment[] | string, delayMs = 0) {
    if (settings.settings?.voiceAnnouncements === false) return;
    const list = typeof segments === "string" ? [{ id: "line", text: segments }] : segments;
    if (list.length) void read(list, { delayMs });
  }

  /** Whether steps are read aloud by themselves (the play button always works). */
  const autoRead = computed(() => settings.settings?.voiceAnnouncements !== false);

  /** Use the recorded voice of this lesson (lines it has no clip for use the device's voice). */
  const setVoice = (id: string) => (currentVoice.value = id);

  return { available, ready, reading, activeId, autoRead, speak, read, announce, setVoice, stop: stopSpeech };
}
