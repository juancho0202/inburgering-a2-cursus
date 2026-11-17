"""
The listener: a phoneme recogniser (wav2vec 2.0 XLSR-53, fine-tuned on Common Voice to write espeak phonemes; see
scripts/tts/export_listener.py) that hears which sounds a clip has, without knowing which words were meant.

To check a take it scores each planned phoneme (Goodness of Pronunciation, as in pronunciation training):
  1. the recogniser gives, every 20 ms, the probability of each phoneme (CTC log posteriors);
  2. the planned phonemes are force-aligned to those frames (Viterbi over the CTC graph), each within BAND frames of
     the moment Piper's own timing gives for it, so each gets its moment and a missing one cannot borrow a neighbour's;
  3. a phoneme's score is the log probability, around that moment, that the recogniser heard that sound or one it
     cannot tell apart from it (SOUNDS). Near 0: clearly heard. Far below: something else was said, or nothing.
Sounds the recogniser hears clearly where nothing was planned are "extra" (a mumble, a stray syllable).

Everything is deterministic: the same audio gives the same scores (no sampling, fixed weights, fixed threads).
"""

from __future__ import annotations

import hashlib
import json
import unicodedata
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import onnxruntime

SAMPLE_RATE = 16000
FRAME = 0.02  # seconds per output frame (wav2vec 2.0 strides 320 samples at 16 kHz)
BAND = 5  # frames (of 20 ms) around Piper's timing of a sound where the alignment may place it
WINDOW = (2, 4)  # frames before and after the aligned frame where the sound may be heard (CTC spikes are not exact)
NOT_HEARD = -20.0  # the score of a sound that is not in the audio at all
BLANK = 0  # "<pad>" is CTC's blank

# Each sound espeak writes for Dutch, with the recogniser labels that count as hearing it. The recogniser was trained
# on many languages and hears Dutch with an accent: it does not tell ʋ from v, ɑ from a, ɣ from x, and writes ij as
# aɪ and ui as aɪ or aʊ. These sets come from what it heard in good recordings of this course (scripts/tts/README.md,
# "Calibration"): a planned sound counts as heard when the recogniser heard one of its set, so only a really
# different sound, or none, scores low. The first label is the one the sound is aligned on.
SOUNDS: dict[str, tuple[str, ...]] = {
    # vowels (long ones before short, so "eː" is one sound)
    "aː": ("aː", "a", "ɑː", "ɑ"),
    "eː": ("eː", "e", "eɪ", "aɪ", "ɛ", "ɪ"),
    "ɪː": ("eː", "e", "eɪ", "ɪ", "ɛ", "iː", "ɪː"),
    "oː": ("oː", "o", "ɔ", "aʊ", "oʊ", "əʊ", "ɔː", "u", "uː"),
    "ɔː": ("oː", "o", "ɔ", "ɔː", "ʊ", "u"),
    "øː": ("ø", "øː", "y", "oʊ", "œ"),
    "ɛɪ": ("aɪ", "ɛɪ", "eɪ", "ɛ", "ai", "æi", "e"),
    # its open start is often heard as a, its rounded glide as l ("uitzendbureau" as "a l t ʒ …")
    "œy": ("aɪ", "aʊ", "œ", "æ", "ɔɪ", "øː", "ɔø", "y", "a", "ɑ", "l"),
    "ʌʊ": ("aʊ", "ʌ", "ɑː", "ɔ", "oʊ", "au", "ʊ"),
    "eʊ": ("eʊ", "eː", "iː", "eɪ", "oʊ", "u", "uː"),
    "yʊ": ("uː", "y", "u", "ʊ", "w", "iː", "yː"),
    "a": ("a", "aː", "ɑ", "ɑː"),
    "ɑ": ("a", "ɑ", "ɔ", "ɑː", "ɒ", "ʌ", "æ"),
    "ɛ": ("ɛ", "e", "æ", "ɪ", "eː", "ə"),
    "e": ("e", "eː", "ɛ", "ɪ", "eɪ"),
    "ɪ": ("ɪ", "i", "iː", "e", "eː", "ə", "ɨ", "ᵻ"),
    "i": ("iː", "i", "ɪ", "j"),
    "ɔ": ("ɔ", "oː", "o", "ʊ", "ɒ", "ɔː", "u", "uː"),
    "o": ("o", "oː", "ɔ", "oʊ", "u"),
    "u": ("uː", "u", "ʊ", "w"),
    "y": ("y", "yː", "uː", "u", "ʉ", "i", "iː", "j"),
    "ɵ": ("y", "ə", "ʊ", "ɵ", "ø", "œ", "ɪ", "u", "uː", "ɨ"),
    "œ": ("œ", "ø", "ə", "ɵ"),
    "ʊ": ("ʊ", "u", "uː", "w", "ɔ", "oː"),
    "ø": ("ø", "øː", "œ", "y"),
    "ə": ("ə", "ɪ", "ɛ", "ɐ", "ᵻ", "ʊ", "ɜ", "ɨ", "e", "i"),
    # consonants
    "b": ("b", "p", "β"),
    "d": ("d", "t"),
    "f": ("f", "v"),
    "h": ("h", "x", "ç", "ħ"),
    "j": ("j", "i", "iː", "ʝ", "ɪ"),
    "k": ("k", "ɡ", "q"),
    "l": ("l", "ɫ", "ɭ"),
    "m": ("m",),
    "n": ("n", "ŋ", "m", "ɲ"),
    "p": ("p", "b"),
    "r": ("r", "ɾ", "ɹ", "ʁ", "ɻ", "ɚ", "ɐ", "ə", "χ"),
    "ɾ": ("ɾ", "r", "ɹ", "ʁ", "ɻ", "ɚ", "ɐ", "ə"),
    "s": ("s", "ʃ", "z", "ts", "ɕ"),
    "t": ("t", "d"),
    "tʲ": ("tʃ", "t", "tʲ", "c", "tɕ", "ç"),
    "v": ("v", "f", "w", "ʋ"),
    "w": ("w", "v", "u", "ʋ", "ʊ"),
    "ʋ": ("v", "w", "ʋ", "β", "f"),
    "x": ("x", "ç", "χ", "h", "ɣ", "k"),
    "ɣ": ("x", "ɣ", "ç", "ɡ", "h", "χ", "k"),
    "ɡ": ("ɡ", "x", "k", "ɣ"),
    "z": ("z", "s", "ʃ", "ʒ"),
    "ŋ": ("ŋ", "n", "m"),
    "ɲ": ("n", "j", "ɲ", "nʲ"),
    "ʃ": ("ʃ", "s", "j", "tʃ", "ç", "ɕ"),
    "ʒ": ("ʒ", "ʃ", "z", "dʒ"),
}
_UNITS = sorted(SOUNDS, key=len, reverse=True)
_SKIPPED = set("ˈˌ ,.:;!?…'\"-ʲː")

@dataclass
class Target:
    unit: str
    """The sound, as espeak writes it ("eː")."""
    label: int
    """Index of the recogniser label for this sound."""
    phoneme: int
    """Index of the plan phoneme (code point) where the sound starts."""


@dataclass
class Heard:
    """A take as the listener heard it."""

    log_probs: np.ndarray
    """frames x labels."""

    def greedy(self, labels: list[str]) -> list[tuple[int, str]]:
        """What it heard, as (frame, phoneme): the recogniser's best guess, without knowing the text."""
        best = self.log_probs.argmax(-1)
        out, previous = [], BLANK
        for f, b in enumerate(best):
            if b != previous and b != BLANK:
                out.append((f, labels[b]))
            previous = b
        return out


class Listener:
    def __init__(self, folder: Path, threads: int = 4):
        meta = json.loads((folder / "listener.json").read_text())
        model = folder / "model.onnx"
        digest = hashlib.sha256()
        with model.open("rb") as f:
            for block in iter(lambda: f.read(1 << 24), b""):
                digest.update(block)
        if digest.hexdigest() != meta["sha256"]:
            raise ValueError(f"{model} is not the exported listener (sha256 differs): run export_listener.py again")
        self.revision = meta["revision"]
        self.labels: list[str] = [unicodedata.normalize("NFD", l) for l in json.loads((folder / "vocab.json").read_text())]
        self.index = {l: i for i, l in enumerate(self.labels)}
        self._accepted: dict[str, np.ndarray] = {}
        missing = {l for labels in SOUNDS.values() for l in labels[:1] if l not in self.index}
        if missing:
            raise ValueError(f"the listener has no label for {missing}")
        options = onnxruntime.SessionOptions()
        # a fixed number of threads: sums are added in the same order every time
        options.intra_op_num_threads = threads
        options.inter_op_num_threads = 1
        self.session = onnxruntime.InferenceSession(str(model), options, providers=["CPUExecutionProvider"])

    def hear(self, audio: np.ndarray, sample_rate: int) -> Heard:
        x = resample(audio.astype(np.float64), sample_rate, SAMPLE_RATE)
        # the model was trained on zero-mean, unit-variance audio
        x = (x - x.mean()) / (x.std() + 1e-7)
        log_probs = self.session.run(None, {"audio": x[None].astype(np.float32)})[0][0]
        return Heard(log_probs)

    def targets(self, phonemes: list[str]) -> list[Target]:
        """The plan's sounds (SOUNDS), each with the label it is aligned on: "eː" is one sound, "e" and "ː" are not."""
        out: list[Target] = []
        text = "".join(phonemes)
        i = 0
        while i < len(phonemes):
            unit = next((u for u in _UNITS if text.startswith(u, i)), None)
            if unit:
                out.append(Target(unit, self.index[SOUNDS[unit][0]], i))
                i += len(unit)
            else:
                if phonemes[i] not in _SKIPPED:
                    raise ValueError(f"no sound for phoneme {phonemes[i]!r} in {text!r}: add it to SOUNDS")
                i += 1
        return out

    def accepted(self, unit: str) -> np.ndarray:
        """The label indexes that count as hearing `unit`."""
        if unit not in self._accepted:
            self._accepted[unit] = np.array([self.index[l] for l in SOUNDS[unit] if l in self.index])
        return self._accepted[unit]


def resample(x: np.ndarray, rate: int, to: int) -> np.ndarray:
    """Band-limited resampling by FFT (exact and deterministic; the clips are short)."""
    if rate == to:
        return x
    n = int(round(len(x) * to / rate))
    spectrum = np.fft.rfft(x)
    keep = n // 2 + 1
    if keep <= len(spectrum):
        spectrum = spectrum[:keep]
    else:
        spectrum = np.concatenate([spectrum, np.zeros(keep - len(spectrum), dtype=spectrum.dtype)])
    return np.fft.irfft(spectrum, n) * (n / len(x))


def force_align(log_probs: np.ndarray, labels: list[int], bands: list[tuple[int, int]] | None = None) -> np.ndarray | None:
    """
    The frame where each label is said, on the most likely CTC path that says exactly `labels` (Viterbi).
    With `bands`, label k may only be said in frames bands[k][0] up to bands[k][1]. None when the clip is too short to
    hold them all (or the bands leave no path).
    """
    T, K = len(log_probs), len(labels)
    if K == 0:
        return np.zeros(0, dtype=np.int64)
    S = 2 * K + 1
    states = np.full(S, BLANK, dtype=np.int64)
    states[1::2] = labels
    # a state may skip the blank before it unless it repeats the label two states back
    skip = np.zeros(S, dtype=bool)
    skip[3::2] = states[3::2] != states[1:-2:2]
    NEG = -1e30
    emit = log_probs[:, states].astype(np.float64)
    if bands is not None:
        frames_ = np.arange(T)[:, None]
        lo = np.array([b[0] for b in bands])[None, :]
        hi = np.array([b[1] for b in bands])[None, :]
        emit[:, 1::2] = np.where((frames_ >= lo) & (frames_ < hi), emit[:, 1::2], NEG)
    score = np.full(S, NEG)
    score[0] = emit[0, 0]
    score[1] = emit[0, 1]
    back = np.zeros((T, S), dtype=np.int8)  # 0 stay, 1 from previous state, 2 skipped a blank
    for t in range(1, T):
        stay = score
        step = np.concatenate([[NEG], score[:-1]])
        jump = np.where(skip, np.concatenate([[NEG, NEG], score[:-2]]), NEG)
        best = np.maximum(stay, np.maximum(step, jump))
        back[t] = np.where(best == stay, 0, np.where(best == step, 1, 2))
        score = np.maximum(best + emit[t], NEG)
    end = S - 1 if score[S - 1] >= score[S - 2] else S - 2
    if score[end] <= NEG / 2:
        return None
    frames = np.zeros(K, dtype=np.int64)
    s = end
    for t in range(T - 1, -1, -1):
        if s % 2 == 1:
            frames[s // 2] = t  # ends at the first (earliest) frame of the label after the loop
        s -= int(back[t, s])
    return frames


VOWELS = {u for u in SOUNDS if u[0] in "aeiouyøœɑɛɪɔəɵʌ"}


_CONSONANT_LETTERS = set("bdfhjklmnprstvwxzŋɡɣɲɾʃʒʋ")
_STOPS = set("pbtdk")


def optional(phonemes: list[str], start: int, end: int, at: int, unit: str) -> bool:
    """
    Sounds fluent Dutch often leaves out or weakens, so the voice may too, and the listener then misses them. Their
    score says nothing:
      - a schwa;
      - the h of an unstressed word ("het" is [ət]) or after a consonant, in the word or before it (Arnhem, "stopt hier");
      - the n of a final -en ("lopen" is [loːpə]);
      - an r after a long vowel, at the end of a word or before a consonant ("uur", "leerplicht": a vowel-like r;
        after a short vowel, as in "morgen", it stays);
      - a stop between two consonants ("ambtenaar" is [ɑmtənaːr], "huisarts");
      - the second of two same sounds in a row (espeak writes "sorry" with ɾ and r).
    """
    word = phonemes[start:end]
    letters = [(i, p) for i, p in enumerate(phonemes[start:end], start) if p not in "ˈˌː"]
    k = next(n for n, (i, _) in enumerate(letters) if i == at)
    before = letters[k - 1][1] if k > 0 else None
    after = letters[k + 1][1] if k + 1 < len(letters) else None
    if unit == "ə":
        return True
    if unit == "h":
        if before is None:  # the first sound of the word: the sound before it is the end of the word before
            before = next((p for p in reversed(phonemes[:start]) if p not in "ˈˌː "), None)
        return "ˈ" not in word or before in _CONSONANT_LETTERS
    if unit == "n" and at == end - 1 and before == "ə":
        return True
    if unit in ("r", "ɾ") and (after is None or after in _CONSONANT_LETTERS):
        vowel = "".join(p for p in phonemes[start:at] if p not in "ˈˌ")[-2:]
        if vowel.endswith(("ː", "y", "i", "u")) or vowel in ("ɛɪ", "œy", "ʌʊ"):
            return True
    if unit in _STOPS and before in _CONSONANT_LETTERS and after in _CONSONANT_LETTERS:
        return True
    if before is not None and (before == unit or {before, unit} <= {"r", "ɾ"}):
        return True
    return False


@dataclass
class SoundScore:
    unit: str
    phoneme: int
    """Index of the sound in its sentence's phonemes."""
    frame: int
    """Listener frame where it was aligned (FRAME seconds each)."""
    score: float
    """log probability that the recogniser heard this sound (or one it does not tell apart from it) there."""
    optional: bool


@dataclass
class Extra:
    frame: int
    label: str
    probability: float


def score_take(
    listener: "Listener", heard: Heard, sentences: list, timings: list[list[tuple[float, float]]] | None = None, band: int | None = None
) -> tuple[list[list[SoundScore]], list[Extra]] | None:
    """
    Scores every planned sound of a take (a list of plan Sentences, said one after another), and finds sounds the
    recogniser heard clearly where none was planned.

    The planned sounds are force-aligned to the audio. With `timings` (per sentence, per phoneme: start and end in
    seconds, Piper's own timing) each sound may only be placed within BAND frames of where the voice meant to say it,
    so a missing word cannot borrow its sounds from the next one, and a sound planned after the end of the audio (a
    take cut off) is not heard at all. Without timings (an old recording) the alignment is free, which finds less.
    None when the take is too short to hold the plan.
    """
    band = BAND if band is None else band
    flat: list[tuple[int, Target]] = [(si, t) for si, s in enumerate(sentences) for t in listener.targets(s.phonemes)]
    lp = heard.log_probs
    T = len(lp)
    present = list(range(len(flat)))
    bands = None
    if timings is not None:
        planned = []
        for si, t in flat:
            last = min(t.phoneme + len(t.unit) - 1, len(timings[si]) - 1)
            planned.append((int(timings[si][t.phoneme][0] / FRAME), int(np.ceil(timings[si][last][1] / FRAME))))
        present = [k for k, (lo, _) in enumerate(planned) if lo < T]
        bands = [(max(0, planned[k][0] - band), min(T, planned[k][1] + band)) for k in present]
    aligned = force_align(lp, [flat[k][1].label for k in present], bands)
    if aligned is None and bands is not None:
        aligned = force_align(lp, [flat[k][1].label for k in present])
    if aligned is None:
        return None
    frame_of = dict(zip(present, aligned.tolist()))
    scores: list[list[SoundScore]] = [[] for _ in sentences]
    windows: list[tuple[int, int]] = []
    words_of = [{i: w for w in s.words for i in range(w.start, w.end)} for s in sentences]
    for k, (si, t) in enumerate(flat):
        w = words_of[si].get(t.phoneme)
        is_optional = optional(sentences[si].phonemes, w.start, w.end, t.phoneme, t.unit) if w else True
        if k not in frame_of:
            # planned after the end of the audio: the take was cut off before it
            scores[si].append(SoundScore(t.unit, t.phoneme, T, NOT_HEARD, is_optional))
            windows.append((T, T))
            continue
        f = frame_of[k]
        lo, hi = max(0, f - WINDOW[0]), f + WINDOW[1]
        windows.append((lo, hi))
        score = float(np.max(np.logaddexp.reduce(lp[lo:hi][:, listener.accepted(t.unit)], axis=1)))
        scores[si].append(SoundScore(t.unit, t.phoneme, f, max(score, NOT_HEARD), is_optional))
    return scores, extra_sounds(listener, lp, [t for _, t in flat], windows)


def extra_sounds(listener: "Listener", lp: np.ndarray, targets: list[Target], windows: list[tuple[int, int]]) -> list[Extra]:
    """Clear sounds (a CTC spike above 70 %) that no planned sound around that moment accepts."""
    out: list[Extra] = []
    best = lp.argmax(-1)
    for f in np.nonzero(best != BLANK)[0]:
        label = int(best[f])
        p = float(np.exp(lp[f, label]))
        if p < 0.7:
            continue
        if any(lo - 1 <= f < hi + 1 and label in listener.accepted(t.unit) for t, (lo, hi) in zip(targets, windows)):
            continue
        out.append(Extra(int(f), listener.labels[label], p))
    return out
