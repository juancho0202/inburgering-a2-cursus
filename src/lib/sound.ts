/**
 * Game-like sounds and short lesson tunes, made live with the Web Audio API: no audio files, no libraries.
 * The instruments are small synthesizers (an FM electric piano, a plucked string, vibraphone, kalimba, marimba,
 * bass and brushed drums) played through a generated reverb.
 * Every function is a no-op when the browser has no Web Audio (tests, very old browsers).
 */

interface Bus {
  dry: AudioNode;
  /** Reverb send. */
  send: AudioNode;
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let reverbIn: GainNode | null = null;
let sfx: Bus | null = null;
let noise: AudioBuffer | null = null;

function gainNode(c: AudioContext, value: number) {
  const g = c.createGain();
  g.gain.value = value;
  return g;
}

/** A stereo reverb tail: decaying noise that gets darker as it fades. */
function impulse(c: AudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    let y = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const x = (Math.random() * 2 - 1) * (1 - t) ** 3;
      y += (x - y) * (0.9 - 0.75 * t); // one-pole low-pass, closing over time
      d[i] = y;
    }
  }
  return buf;
}

function audio(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  if (!ctx) {
    ctx = new AudioContext();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.25;
    master = gainNode(ctx, 0.55);
    master.connect(comp).connect(ctx.destination);
    const conv = ctx.createConvolver();
    conv.buffer = impulse(ctx, 2.6);
    reverbIn = gainNode(ctx, 1);
    reverbIn.connect(conv).connect(gainNode(ctx, 0.4)).connect(master);
    sfx = { dry: gainNode(ctx, 0.9), send: reverbIn };
    (sfx.dry as GainNode).connect(master);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const n = noise.getChannelData(0);
    for (let i = 0; i < n.length; i++) n[i] = Math.random() * 2 - 1;
  }
  // Browsers start the context suspended until the page has had a click or key press.
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

/** Output stage of one note: envelope gain → panner → bus (dry + reverb send). Returns the envelope gain. */
function voice(c: AudioContext, bus: Bus, pan: number, wet: number): GainNode {
  const env = c.createGain();
  env.gain.value = 0;
  const p = c.createStereoPanner();
  p.pan.value = pan;
  env.connect(p);
  p.connect(bus.dry);
  p.connect(gainNode(c, wet)).connect(bus.send);
  return env;
}

/** Fast attack, smooth exponential decay to `sustain`, release at `t + dur`. */
function envelope(g: AudioParam, t: number, peak: number, attack: number, sustain: number, decay: number, dur: number, release: number) {
  g.setValueAtTime(0, t);
  g.linearRampToValueAtTime(peak, t + attack);
  g.setTargetAtTime(peak * sustain, t + attack, decay);
  g.setTargetAtTime(0, t + dur, release);
}

function osc(c: AudioContext, type: OscillatorType, freq: number, to: AudioNode, t: number, end: number) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  o.connect(to);
  o.start(t);
  o.stop(end);
  return o;
}

// ----- instruments -----

type Instrument = (bus: Bus, midi: number, t: number, dur: number, vel: number, pan?: number) => void;

/** Rhodes-like electric piano: a sine carrier frequency-modulated by a sine, with a bright "bark" that fades fast. */
const ePiano: Instrument = (bus, midi, t, dur, vel, pan = 0) => {
  const c = audio()!;
  const f = hz(midi);
  const end = t + dur + 1.2;
  const env = voice(c, bus, pan, 0.35);
  envelope(env.gain, t, vel, 0.004, 0.22, 0.45, dur, 0.18);
  const mod = c.createGain();
  mod.gain.setValueAtTime(f * 2.4 * Math.min(1, vel * 2), t);
  mod.gain.setTargetAtTime(f * 0.35, t, 0.12);
  osc(c, "sine", f, mod, t, end);
  const a = osc(c, "sine", f, env, t, end);
  // A second, slightly detuned carrier: the chorus-like shimmer of a real Rhodes.
  const chorus = gainNode(c, 0.45);
  chorus.connect(env);
  const b = osc(c, "sine", f * 1.0035, chorus, t, end);
  mod.connect(a.frequency);
  mod.connect(b.frequency);
  // The "tine": a tiny metallic ping on top.
  const tine = voice(c, bus, pan, 0.4);
  envelope(tine.gain, t, vel * 0.07, 0.002, 0.0, 0.03, 0.1, 0.03);
  osc(c, "sine", f * 7, tine, t, t + 0.3);
};

const stringCache = new Map<number, AudioBuffer>();
/** Plucked string (Karplus–Strong): a burst of soft noise circulating in a short delay line. */
const pluck: Instrument = (bus, midi, t, dur, vel, pan = 0) => {
  const c = audio()!;
  let buf = stringCache.get(midi);
  if (!buf) {
    const sr = c.sampleRate;
    const n = Math.round(sr / hz(midi));
    const len = Math.floor(sr * 2);
    buf = c.createBuffer(1, len, sr);
    const d = buf.getChannelData(0);
    const line = new Float32Array(n);
    let prev = 0;
    for (let i = 0; i < n; i++) line[i] = prev = (prev + (Math.random() * 2 - 1)) / 2; // soft pick
    for (let i = 0; i < len; i++) {
      const j = i % n;
      d[i] = line[j];
      line[j] = 0.5 * (line[j] + line[(j + 1) % n]) * 0.997;
    }
    stringCache.set(midi, buf);
  }
  const src = c.createBufferSource();
  src.buffer = buf;
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 3800;
  const env = voice(c, bus, pan, 0.3);
  envelope(env.gain, t, vel * 1.4, 0.002, 1, 10, dur + 0.4, 0.25);
  src.connect(lp).connect(env);
  src.start(t);
  src.stop(t + dur + 1.5);
};

/** Vibraphone: sine + 4th harmonic, with the motor's gentle tremolo. */
const vibes: Instrument = (bus, midi, t, dur, vel, pan = 0) => {
  const c = audio()!;
  const f = hz(midi);
  const end = t + dur + 2;
  const env = voice(c, bus, pan, 0.45);
  envelope(env.gain, t, vel, 0.003, 0.0, 0.9, dur + 0.6, 0.4);
  const trem = gainNode(c, 0.8);
  const lfo = c.createOscillator();
  lfo.frequency.value = 5.2;
  const depth = gainNode(c, 0.2);
  lfo.connect(depth).connect(trem.gain);
  lfo.start(t);
  lfo.stop(end);
  trem.connect(env);
  osc(c, "sine", f, trem, t, end);
  const over = c.createGain();
  envelope(over.gain, t, 0.22, 0.002, 0, 0.12, 0.3, 0.1);
  osc(c, "sine", f * 4, over, t, t + 0.8);
  over.connect(trem);
};

/** Kalimba: warm fundamental with a short, slightly out-of-tune overtone. */
const kalimba: Instrument = (bus, midi, t, dur, vel, pan = 0) => {
  const c = audio()!;
  const f = hz(midi);
  const env = voice(c, bus, pan, 0.4);
  envelope(env.gain, t, vel, 0.002, 0, 0.42, dur + 0.5, 0.3);
  osc(c, "sine", f, env, t, t + dur + 1.6);
  const over = c.createGain();
  envelope(over.gain, t, 0.28, 0.001, 0, 0.05, 0.15, 0.05);
  osc(c, "sine", f * 5.4, over, t, t + 0.4);
  over.connect(env);
};

/** Marimba: round wooden tone with a quick click. */
const marimba: Instrument = (bus, midi, t, dur, vel, pan = 0) => {
  const c = audio()!;
  const f = hz(midi);
  const env = voice(c, bus, pan, 0.3);
  envelope(env.gain, t, vel, 0.002, 0, 0.28, dur + 0.3, 0.15);
  osc(c, "sine", f, env, t, t + dur + 1.2);
  const over = c.createGain();
  envelope(over.gain, t, 0.35, 0.001, 0, 0.035, 0.1, 0.03);
  osc(c, "sine", f * 4, over, t, t + 0.3);
  over.connect(env);
};

const bass: Instrument = (bus, midi, t, dur, vel) => {
  const c = audio()!;
  const f = hz(midi);
  const lp = c.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 520;
  const env = voice(c, bus, 0, 0.05);
  envelope(env.gain, t, vel, 0.012, 0.5, 0.35, dur, 0.1);
  lp.connect(env);
  osc(c, "sine", f, lp, t, t + dur + 0.6);
  const body = gainNode(c, 0.3);
  body.connect(lp);
  osc(c, "triangle", f, body, t, t + dur + 0.6);
};

function noiseHit(bus: Bus, t: number, vel: number, type: BiquadFilterType, freq: number, q: number, decay: number, pan: number, wet: number) {
  const c = audio()!;
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const env = voice(c, bus, pan, wet);
  envelope(env.gain, t, vel, 0.002, 0, decay, decay * 4, decay);
  src.connect(f).connect(env);
  src.start(t, Math.random() * 0.5);
  src.stop(t + decay * 8);
}
const hat = (bus: Bus, t: number, vel: number) => noiseHit(bus, t, vel, "highpass", 7500, 0.7, 0.022, 0.35, 0.1);
const brush = (bus: Bus, t: number, vel: number) => noiseHit(bus, t, vel, "bandpass", 2600, 0.6, 0.07, -0.2, 0.3);

function kick(bus: Bus, t: number, vel: number) {
  const c = audio()!;
  const env = voice(c, bus, 0, 0);
  envelope(env.gain, t, vel, 0.003, 0, 0.11, 0.3, 0.05);
  const o = osc(c, "sine", 110, env, t, t + 0.5);
  o.frequency.setValueAtTime(115, t);
  o.frequency.exponentialRampToValueAtTime(44, t + 0.13);
}

/** Airy noise sweeping up: the "wow" under a success sound. */
function whoosh(bus: Bus, t: number, vel: number, dur = 0.45) {
  const c = audio()!;
  const src = c.createBufferSource();
  src.buffer = noise;
  const f = c.createBiquadFilter();
  f.type = "bandpass";
  f.Q.value = 1.4;
  f.frequency.setValueAtTime(700, t);
  f.frequency.exponentialRampToValueAtTime(6000, t + dur);
  const env = voice(c, bus, 0, 0.7);
  env.gain.setValueAtTime(0, t);
  env.gain.linearRampToValueAtTime(vel, t + dur * 0.6);
  env.gain.linearRampToValueAtTime(0, t + dur);
  src.connect(f).connect(env);
  src.start(t);
  src.stop(t + dur + 0.05);
}

/** Two slightly detuned high sines with lots of reverb. */
function shimmer(bus: Bus, midi: number, t: number, vel: number) {
  const c = audio()!;
  for (const [detune, pan] of [[1, -0.4], [1.006, 0.4]]) {
    const env = voice(c, bus, pan, 0.9);
    envelope(env.gain, t, vel, 0.06, 0, 0.5, 1.2, 0.4);
    osc(c, "sine", hz(midi) * detune, env, t, t + 2.5);
  }
}

// ----- answer sounds -----

let streak = 0;
/** Answers right in a row climb this ladder: the Lydian scale, whose raised 4th sounds bright and a little magical. */
const LYDIAN = [0, 2, 4, 6, 7, 9, 11, 12];

/**
 * A short melodic "sol–do–mi" on the electric piano; the last note rings over a soft chord with a faint shimmer.
 * Answers right in a row lift the phrase one step up the Lydian scale (like a combo); reaching the octave adds a
 * high note as a reward, and the ladder starts again.
 */
export function playCorrect() {
  const c = audio();
  if (!c || !sfx) return;
  const t = c.currentTime + 0.01;
  const step = streak % LYDIAN.length;
  const root = 72 + LYDIAN[step];
  streak++;
  ePiano(sfx, root - 5, t, 0.1, 0.26, -0.15);
  ePiano(sfx, root, t + 0.075, 0.1, 0.28, 0);
  ePiano(sfx, root + 4, t + 0.15, 0.45, 0.32, 0.15);
  [root - 12, root - 8, root - 5].forEach((n, i) => ePiano(sfx!, n, t + 0.15 + i * 0.012, 0.45, 0.1, -0.2 + i * 0.2));
  shimmer(sfx, root + 16, t + 0.2, 0.015);
  if (step === LYDIAN.length - 1) ePiano(sfx, root + 12, t + 0.225, 0.45, 0.22, 0.3);
}

/** Simple and soft: two Gs an octave apart stepping down to the F♯s just below, on the electric piano. */
export function playWrong() {
  const c = audio();
  if (!c || !sfx) return;
  streak = 0;
  const t = c.currentTime + 0.01;
  [55, 67].forEach((n, i) => ePiano(sfx!, n, t, 0.11, 0.22, i ? 0.15 : -0.15));
  [54, 66].forEach((n, i) => ePiano(sfx!, n, t + 0.12, 0.4, 0.22, i ? 0.15 : -0.15));
}

/** End of a lesson: a little ii–V–I with sparkle when passed; a gentle, warm chord otherwise. */
export function playComplete(passed: boolean) {
  const c = audio();
  if (!c || !sfx) return;
  streak = 0;
  const t = c.currentTime + 0.02;
  if (passed) {
    const chords: [number, number[]][] = [[50, [65, 69, 72, 76]], [55, [65, 69, 71, 74]], [48, [64, 67, 71, 74, 79]]];
    chords.forEach(([b, notes], i) => {
      const at = t + i * 0.32;
      bass(sfx!, b - 12, at, i === 2 ? 1.2 : 0.3, 0.35);
      notes.forEach((n, j) => ePiano(sfx!, n, at + j * 0.012, i === 2 ? 1.4 : 0.28, 0.2, -0.3 + j * 0.15));
    });
    const end = t + 0.64;
    kick(sfx, end, 0.4);
    [76, 79, 83, 86, 91].forEach((n, i) => ePiano(sfx!, n, end + 0.08 + i * 0.07, 0.4, 0.2, -0.4 + i * 0.2));
    whoosh(sfx, end - 0.2, 0.06, 0.6);
    shimmer(sfx, 91, end + 0.4, 0.04);
  } else {
    bass(sfx, 36, t, 1.4, 0.3);
    [60, 64, 67, 74, 76].forEach((n, i) => kalimba(sfx!, n, t + i * 0.14, 1.2, 0.3, -0.3 + i * 0.15));
  }
}

// ----- lesson tunes -----

/** A chord: bass note and a rootless jazz voicing, in semitones from the key's C. */
type Chord = { bass: number; notes: number[] };
const I: Chord = { bass: 0, notes: [4, 7, 11, 14] }; // Cmaj9
const ii: Chord = { bass: 2, notes: [5, 9, 12, 16] }; // Dm9
const iii: Chord = { bass: 4, notes: [2, 7, 11, 14] }; // Em7
const IV: Chord = { bass: 5, notes: [4, 9, 12, 16] }; // Fmaj9
const V: Chord = { bass: 7, notes: [5, 9, 12, 14] }; // G9sus
const vi: Chord = { bass: 9, notes: [4, 7, 9, 12] }; // Am7

/** Two bars, four chords each: lesson n uses progression (n - 1) % 8. */
const PROGRESSIONS: Chord[][] = [
  [I, vi, ii, V],
  [I, IV, iii, vi],
  [IV, I, ii, V],
  [vi, IV, I, V],
  [ii, V, I, vi],
  [I, iii, IV, V],
  [IV, V, iii, vi],
  [I, V, vi, IV],
];

/** Rhythms for the melody, as eighth notes 0–15 over the two bars. */
const RHYTHMS = [
  [0, 3, 4, 6, 8, 11, 12],
  [2, 3, 5, 8, 10, 13],
  [0, 2, 3, 6, 9, 10, 12],
  [1, 3, 4, 7, 8, 11, 14],
  [0, 3, 6, 8, 9, 11, 12],
  [2, 4, 5, 7, 10, 12],
];

const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // major pentatonic over two octaves

/** Tiny seeded random generator, so lesson n always gets the same tune. */
function seeded(n: number) {
  let s = (n * 2654435761) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface LessonTune {
  progression: number;
  /** [eighth note 0–15, semitones above the key's C5]; the last note is held. */
  melody: [number, number][];
}

/** The tune of lesson `n` (1-based): the same in every module, so the place in a module becomes familiar. */
export function lessonTune(n: number): LessonTune {
  const rnd = seeded(n);
  const progression = (n - 1) % PROGRESSIONS.length;
  const rhythm = RHYTHMS[Math.floor(rnd() * RHYTHMS.length)];
  let idx = 2 + Math.floor(rnd() * 4);
  const melody: [number, number][] = rhythm.map((pos) => {
    idx = Math.max(0, Math.min(SCALE.length - 1, idx + Math.floor(rnd() * 5) - 2));
    return [pos, SCALE[idx]];
  });
  // Land on a note of the last chord.
  const lastChord = PROGRESSIONS[progression][3];
  const last = melody[melody.length - 1];
  const target = lastChord.notes.map((x) => x + (last[1] >= 12 ? 12 : 0));
  last[1] = target.reduce((a, b) => (Math.abs(b - last[1]) < Math.abs(a - last[1]) ? b : a));
  return { progression, melody };
}

/** Each module: its own key and lead instrument; the band (e-piano, bass, brushes) stays the same. */
const MODULE_SOUND: { key: number; lead: Instrument }[] = [
  { key: 0, lead: ePiano }, // basis
  { key: 2, lead: pluck }, // lezen
  { key: 5, lead: vibes }, // knm
  { key: -2, lead: kalimba }, // schrijven
  { key: -3, lead: marimba }, // exams
];

const BPM = 84;
let music: { bus: Bus; gains: GainNode[] } | null = null;

/** Fade out the lesson tune (when the learner moves on before it ends). */
export function stopMusic(fade = 0.3) {
  if (!ctx || !music) return;
  const t = ctx.currentTime;
  for (const g of music.gains) {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(g.gain.value, t);
    g.gain.linearRampToValueAtTime(0, t + fade);
  }
  music = null;
}

/**
 * Two laid-back bars at the start of a lesson: jazzy chords, bass, swung brushes and the lesson's melody.
 * The music ducks when the voice comes in. Returns when the voice should start, in ms (0 when there is no audio).
 */
export function playLessonMelody(lessonNumber: number, moduleIndex: number): number {
  const c = audio();
  if (!c || !master || !reverbIn) return 0;
  stopMusic(0.1);
  streak = 0;
  const m = MODULE_SOUND[((moduleIndex % MODULE_SOUND.length) + MODULE_SOUND.length) % MODULE_SOUND.length];
  const tune = lessonTune(lessonNumber);
  const chords = PROGRESSIONS[tune.progression];

  const dry = gainNode(c, 0.8);
  const send = gainNode(c, 1);
  // "Going far": a low-pass on the dry sound that closes, so the band seems to drift away.
  const far = c.createBiquadFilter();
  far.type = "lowpass";
  far.frequency.value = 18000;
  dry.connect(far).connect(master);
  send.connect(reverbIn);
  const bus: Bus = { dry, send };
  music = { bus, gains: [dry, send] };

  const beat = 60 / BPM;
  const t0 = c.currentTime + 0.05;
  const rnd = seeded(lessonNumber * 31 + 7);
  // Swing: the second eighth of each beat comes late; everything is a few ms "human".
  const at = (eighth: number) => t0 + Math.floor(eighth / 2) * beat + (eighth % 2 ? beat * 0.62 : 0) + (rnd() - 0.5) * 0.012;
  const C4 = 60 + m.key;

  chords.forEach((ch, i) => {
    const start = t0 + i * 2 * beat;
    const last = i === chords.length - 1;
    ch.notes.forEach((n, j) => ePiano(bus, C4 + n, start + j * 0.014, last ? 2.6 : 2 * beat * 0.92, 0.13, -0.25 + j * 0.17));
    // A soft re-hit on the "and" of the second beat.
    if (!last) ch.notes.slice(1).forEach((n, j) => ePiano(bus, C4 + n, at(i * 4 + 3), beat * 0.5, 0.07, -0.1 + j * 0.15));
    const b = C4 - 24 + ((ch.bass % 12) + 12) % 12;
    bass(bus, b, start, beat * 1.3, 0.42);
    if (!last) bass(bus, b + 7, at(i * 4 + 3), beat * 0.4, 0.26);
    else bass(bus, b, start + beat, 2.2, 0.32);
  });

  for (let e = 0; e < 16; e++) hat(bus, at(e), e % 2 ? 0.05 : 0.09);
  [0, 5, 8, 12].forEach((e) => kick(bus, at(e), 0.3));
  [2, 6, 10, 14].forEach((e) => brush(bus, at(e), 0.13));

  tune.melody.forEach(([pos, semis], i) => {
    const held = i === tune.melody.length - 1;
    m.lead(bus, C4 + 12 + semis, at(pos), held ? 2.2 : beat * 0.55, held ? 0.24 : 0.2, 0.15);
  });

  // From 2.25 s the band drifts into the distance (darker, quieter, relatively more room) before the voice
  // comes in on bar 2, then it fades out after the last chord.
  const voiceAt = 4 * beat;
  const end = t0 + 8 * beat;
  const away = t0 + 2.25;
  far.frequency.setValueAtTime(18000, away);
  far.frequency.exponentialRampToValueAtTime(700, away + 1.4);
  dry.gain.setValueAtTime(0.8, away);
  dry.gain.linearRampToValueAtTime(0.4, away + 1.4);
  dry.gain.setValueAtTime(0.4, end);
  dry.gain.linearRampToValueAtTime(0, end + 2);
  send.gain.setValueAtTime(1, away);
  send.gain.linearRampToValueAtTime(0.7, away + 1.4);
  send.gain.setValueAtTime(0.7, end);
  send.gain.linearRampToValueAtTime(0, end + 2.5);
  return Math.round((voiceAt + 0.15) * 1000);
}
