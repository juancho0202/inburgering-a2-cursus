import { computed, onScopeDispose, ref } from "vue";
import type { Fragment } from "@shared/schemas/content";
import { useSettingsStore } from "../stores/settings";
import { fragmentKey } from "../lib/fragments";
import { claimSound, releaseSound, sayWithDevice } from "./useSpeech";

const DIR = "/audio/fragments";

/** Where each line of a recorded fragment starts, in seconds (written by scripts/tts/generate.py). */
export interface FragmentTiming {
  duration: number;
  starts: number[];
}

let timings: Promise<Record<string, FragmentTiming>> | null = null;
/** The fragments recorded for this version of the course; none when there are none. */
export function fragmentTimings(): Promise<Record<string, FragmentTiming>> {
  timings ??= fetch(`${DIR}/manifest.json`)
    .then((r) => (r.ok ? r.json() : {}))
    .then((m: { fragments?: Record<string, FragmentTiming> }) => m.fragments ?? {})
    .catch(() => ({}));
  return timings;
}
/** Forget the list (tests load a different one). */
export const forgetFragmentTimings = () => (timings = null);

/** Without a recording the device's voice reads the lines; a pitch per voice keeps the people apart. */
const PITCH: Record<string, number> = { ronnie: 0.9, alex: 0.7, nathalie: 1.3 };

/** Within this many seconds of the start of a line, "back" goes to the line before it. */
const BACK_GRACE = 1.5;

/**
 * Plays a listening fragment: its recording (with the line being said, to highlight it) or, when there is none,
 * the device's voice line by line ("device"). "none": this device cannot play it, the learner reads the text.
 * Starting it stops the lesson voice, and the lesson voice starting stops it.
 */
export function useFragmentPlayer(fragment: Fragment) {
  const settings = useSettingsStore();
  const mode = ref<"loading" | "recording" | "device" | "none">("loading");
  const playing = ref(false);
  const time = ref(0);
  const duration = ref(0);
  /** The line being said (null before the first line and after the end). */
  const line = ref<number | null>(null);

  const key = fragmentKey(fragment);
  let timing: FragmentTiming | null = null;
  let audio: HTMLAudioElement | null = null;
  /** Bumped on every pause, so device lines that finish late do not carry on. */
  let generation = 0;
  /** Device voice: the line to continue from. */
  let resumeLine = 0;
  let disposed = false;

  const deviceMode = () => (typeof speechSynthesis !== "undefined" ? "device" : "none");
  const rate = () => settings.settings?.speechRate ?? 0.95;

  const loaded = fragmentTimings().then((all) => {
    if (disposed) return;
    const t = all[key];
    if (t && typeof Audio !== "undefined") {
      timing = t;
      duration.value = t.duration;
      mode.value = "recording";
    } else mode.value = deviceMode();
  });

  const lineAt = (seconds: number): number | null => {
    let found: number | null = null;
    timing?.starts.forEach((s, i) => {
      if (s <= seconds + 0.05) found = i;
    });
    return found;
  };

  function pause() {
    generation++;
    playing.value = false;
    audio?.pause();
    if (mode.value === "device" && typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    releaseSound(pause);
  }

  function finished() {
    playing.value = false;
    line.value = null;
    resumeLine = 0;
    releaseSound(pause);
  }

  function useDevice(from: number) {
    audio = null;
    mode.value = deviceMode();
    if (playing.value) void speakFrom(from);
  }

  function ensureAudio(): HTMLAudioElement {
    if (audio) return audio;
    const a = new Audio(`${DIR}/${key}.m4a`);
    a.preload = "auto";
    a.ontimeupdate = () => {
      time.value = a.currentTime;
      line.value = lineAt(a.currentTime);
    };
    a.onloadedmetadata = () => {
      if (Number.isFinite(a.duration) && a.duration > 0) duration.value = a.duration;
    };
    a.onended = () => {
      time.value = duration.value;
      finished();
    };
    // The file is missing (e.g. offline before it was kept): the device's voice reads it instead.
    a.onerror = () => {
      if (audio === a) useDevice(line.value ?? 0);
    };
    audio = a;
    return a;
  }

  async function speakFrom(from: number) {
    const mine = ++generation;
    const voiceOf = new Map(fragment.speakers.map((s) => [s.name, s.voice]));
    for (let i = from; i < fragment.lines.length; i++) {
      line.value = i;
      resumeLine = i;
      const l = fragment.lines[i];
      const said = await sayWithDevice(l.nl, { pitch: PITCH[voiceOf.get(l.speaker) ?? ""] ?? 1, rate: rate() });
      if (mine !== generation) return;
      if (!said) {
        mode.value = "none";
        break;
      }
    }
    finished();
  }

  /** Play from a line, from a time, or (neither) on from where it was paused. */
  async function play(at: { line?: number; seconds?: number } = {}) {
    await loaded;
    if (disposed) return;
    claimSound(pause);
    playing.value = true;
    if (mode.value === "recording") {
      const a = ensureAudio();
      // The recordings are made at a natural pace; the speed setting (default 0.95) is relative to that.
      a.playbackRate = rate() / 0.95;
      if (at.line !== undefined) a.currentTime = timing!.starts[at.line] ?? 0;
      else if (at.seconds !== undefined) a.currentTime = at.seconds;
      else if (a.ended || a.currentTime >= duration.value - 0.05) a.currentTime = 0;
      time.value = a.currentTime;
      try {
        await a.play();
      } catch {
        if (audio === a && playing.value) useDevice(at.line ?? lineAt(a.currentTime) ?? 0);
      }
    } else if (mode.value === "device") void speakFrom(at.line ?? (at.seconds === 0 ? 0 : resumeLine));
    else playing.value = false;
  }

  const toggle = () => (playing.value ? pause() : play());
  const playFrom = (i: number) => play({ line: i });
  const restart = () => play({ seconds: 0 });

  /** One line back: to the start of the line being said, or to the line before when it has only just begun. */
  function back() {
    const current = mode.value === "recording" ? (lineAt(time.value) ?? 0) : resumeLine;
    const intoLine = mode.value === "recording" && timing ? time.value - (timing.starts[current] ?? 0) : 0;
    const target = intoLine > BACK_GRACE ? current : Math.max(0, current - 1);
    if (playing.value) return play({ line: target });
    // Paused: only move, the learner presses play.
    resumeLine = target;
    if (mode.value === "recording" && timing) {
      const a = ensureAudio();
      a.currentTime = time.value = timing.starts[target] ?? 0;
    }
    line.value = target;
  }

  function seek(seconds: number) {
    if (mode.value !== "recording") return;
    const a = ensureAudio();
    a.currentTime = time.value = seconds;
    line.value = lineAt(seconds);
  }

  const progress = computed(() => {
    if (mode.value === "recording") return duration.value ? time.value / duration.value : 0;
    return line.value === null ? 0 : (line.value + 1) / fragment.lines.length;
  });

  onScopeDispose(() => {
    disposed = true;
    if (audio) {
      audio.onerror = audio.ontimeupdate = audio.onended = audio.onloadedmetadata = null;
      audio.pause();
    }
    if (playing.value) pause();
    releaseSound(pause);
  });

  return { mode, playing, time, duration, line, progress, toggle, playFrom, restart, back, seek, pause };
}
