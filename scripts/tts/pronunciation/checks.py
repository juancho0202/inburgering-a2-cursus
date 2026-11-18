"""
The checks. Each finding is one problem in one line, pinned to a word where it can be.

On the plan (what espeak made of the text, before there is any sound). These problems are the same on every take,
so a new take does not help; the fix is a pronunciation in shared/content/pronunciations.ts or other text:
  unknown-phoneme  a phoneme the voice has no id for (Piper would skip it without a word)
  foreign          espeak switched to another language for a word ("website" in English)
  spelled          espeak spells a word letter by letter ("be-" became "bee-ee")
  dictionary       espeak's pronunciation is not the dictionary's (stress or vowel: "meneer", "inburgeren")
  short-eer        espeak says a stressed "eer" with a short vowel ("wanneer" as "wannir", "studeert"): a rule bug of
                   espeak's, so it finds the words the dictionary does not have
  contains         a longer word contains a word espeak is known to get wrong ("verzekeringspas")

On the sound (a take of a line). The voice draws random noise, so another take often fixes these:
  not-heard        the listener did not hear a word as planned (a vowel, two consonants, or the word as a whole)
  extra            the listener heard clear sounds in a word that were not planned (a mumble, a stray syllable)
  too-short        the take is too short to hold all planned sounds (it was cut off)
  drawn-out        a sound lasts unnaturally long
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass, field
from functools import lru_cache

import numpy as np

from .dictionary import Dictionary
from .listener import FRAME, VOWELS, Listener, SoundScore, score_take
from .phonemes import Planner, Sentence, without_stress, word_phonemes
from .seeded import Take

# Set on recordings of this course with known faults put in (scripts/tts/calibrate.py; README "Calibration"). A word
# is not heard when one of its vowels scores below VOWEL, when CONSONANTS_LOW of its consonants score below CONSONANT
# (one weak consonant is often the listener's fault: a t in "rts", an h after a consonant), or when its sounds score
# below MEAN on average with three or more of them (a word gone quiet still lets the listener guess its edges from
# the words around it). The
# scores are log probabilities; optional sounds never count.
VOWEL = -7.0
CONSONANT = -5.0
CONSONANTS_LOW = 2
MEAN = -3.0
EXTRA = 2  # clear unplanned sounds in or next to a word
# Seconds a sound may last at the normal pace (scaled by the pace). In good recordings of this course no vowel lasts
# longer than 0.43 s and no consonant than 0.35 s at pace 1.1.
LONGEST_VOWEL = 0.5
LONGEST_CONSONANT = 0.4


@dataclass
class Finding:
    check: str
    severity: str
    """"error" (wrong, fix it) or "warning" (worth a listen)."""
    word: str
    message: str
    at: float | None = None
    """Seconds into the clip, for the sound checks."""
    detail: dict = field(default_factory=dict)

    @property
    def on_plan(self) -> bool:
        return self.check in PLAN_CHECKS

    def to_json(self) -> dict:
        """Without the empty fields; Finding(**f.to_json()) gives it back."""
        return {k: v for k, v in asdict(self).items() if v is not None and v != {}}


PLAN_CHECKS = {"unknown-phoneme", "foreign", "spelled", "dictionary", "short-eer", "contains"}


@dataclass
class Lists:
    """From shared/content/pronunciations.ts, written to .tts/pronunciations.json by export-texts.ts."""

    pronunciations: dict[str, str]
    espeak_is_right: set[str]
    letter_names: set[str]
    """The words a spelled abbreviation is made of ("vee em bee oo"): said as letter names on purpose."""
    heard_right: dict[str, set[str]] = field(default_factory=dict)
    """By Piper model: words the listener mishears in that voice although they sound right (HEARD_RIGHT)."""

    def without_heard_right(self, model: str, findings: list["Finding"]) -> list["Finding"]:
        """The findings, without the listener's ones about words reviewed as right in this voice."""
        right = self.heard_right.get(model, set())
        return [f for f in findings if not (f.check in ("not-heard", "extra") and f.word.lower() in right)]


class PlanChecker:
    def __init__(self, planner: Planner, lists: Lists, dictionary: Dictionary | None):
        self.planner = planner
        self.lists = lists
        self.dictionary = dictionary
        self.voice = planner.voice
        self._letters = {c: without_stress(word_phonemes(self.voice, c)).replace(" ", "") for c in "abcdefghijklmnopqrstuvwxyz"}
        # Whole words of 7 letters or more: a word part ("-tje") or a short word ("appen" in "boodschappen") inside a
        # longer word is often just the same letters.
        # whole words only: not word parts or phrases ("de of het"), and long enough not to be inside every other word
        self._listed = sorted((w for w in lists.pronunciations if "-" not in w and " " not in w and len(w) >= 7), key=len, reverse=True)

    def check(self, sentences: list[Sentence], missing: set[str]) -> list[Finding]:
        out: list[Finding] = []
        if missing:
            out.append(Finding("unknown-phoneme", "error", "", f"the voice has no sound for {''.join(sorted(missing))}"))
        seen: set[str] = set()
        for s in sentences:
            for w in s.words:
                if w.source != "espeak" or w.text in seen:
                    continue
                seen.add(w.text)
                out.extend(self._word(w.text, w.language))
        return out

    def _word(self, text: str, language: str | None) -> list[Finding]:
        return list(self._word_cached(text, language))

    @lru_cache(maxsize=None)
    def _word_cached(self, text: str, language: str | None) -> tuple[Finding, ...]:
        word = text.lower()
        out: list[Finding] = []
        if word in self.lists.espeak_is_right:
            return ()
        if language:
            out.append(Finding("foreign", "error", text, f"espeak reads it as {language}: add it to PRONUNCIATIONS (or ESPEAK_IS_RIGHT)"))
        letters = re.fullmatch(r"[a-z]{2,}", text)
        if letters and word not in self.lists.letter_names:
            alone = without_stress(word_phonemes(self.voice, word)).replace(" ", "")
            if alone == "".join(self._letters[c] for c in word):
                out.append(Finding("spelled", "error", text, f"espeak spells it letter by letter ({alone}): add it to PRONUNCIATIONS"))
        if "eer" in word:
            alone = word_phonemes(self.voice, word)
            if re.search(r"ɪr", alone):
                out.append(
                    Finding("short-eer", "error", text, f"espeak says the ee short ({alone}): add it to PRONUNCIATIONS with ɪː, as in meer (mˈɪːr)")
                )
        if self.dictionary and word not in self.lists.letter_names:
            d = self.dictionary.disagrees(word, word_phonemes(self.voice, word))
            if d:
                out.append(
                    Finding(
                        "dictionary", "error", text,
                        f"espeak says {d.espeak}, the dictionary {d.dictionary}: add it to PRONUNCIATIONS, or to ESPEAK_IS_RIGHT after listening",
                        detail={"espeak": d.espeak, "dictionary": d.dictionary},
                    )
                )
        if word not in self.lists.pronunciations:
            inside = next((w for w in self._listed if w in word and w != word), None)
            if inside:
                out.append(
                    Finding("contains", "warning", text, f"contains '{inside}', which espeak says wrong: listen, and add '{word}' to PRONUNCIATIONS if it is wrong too")
                )
        return tuple(out)


def check_take(take: Take, listener: Listener | None, pace: float = 1.0) -> list[Finding]:
    """The sound checks for a take made in this run (pace: the length scale it was said with)."""
    plans = [s.plan for s in take.sentences]
    timings = take.timings()
    out = check_timing(plans, timings, pace)
    if listener:
        out += check_heard(listener, listener.hear(take.audio, take.sample_rate), plans, timings)
    return out


def check_recording(listener: Listener, audio: np.ndarray, sample_rate: int, plans: list[Sentence]) -> list[Finding]:
    """The listener's checks for a recording without Piper's timings (made before this check existed)."""
    return check_heard(listener, listener.hear(audio, sample_rate), plans, None)


def check_timing(plans: list[Sentence], timings: list[list[tuple[float, float]]], pace: float) -> list[Finding]:
    """Piper's own timing: a sound held far too long is a stuck voice, whatever the listener hears."""
    out: list[Finding] = []
    for s, timing in zip(plans, timings):
        for w in s.words:
            for sound, at, length in sound_lengths(s.phonemes, timing, w.start, w.end):
                if length > (LONGEST_VOWEL if sound in _VOWEL_LETTERS else LONGEST_CONSONANT) * pace:
                    out.append(Finding("drawn-out", "warning", w.text, f"'{sound}' lasts {length:.2f} s", round(at, 2)))
                    break
    return out


def check_heard(listener: Listener, heard, plans: list[Sentence], timings: list[list[tuple[float, float]]] | None) -> list[Finding]:
    result = score_take(listener, heard, plans, timings)
    if result is None:
        return [Finding("too-short", "error", "", "the recording is too short for its sounds (cut off)")]
    scores, extra = result
    out: list[Finding] = []
    words: list[tuple[str, float]] = []  # each word and its middle (seconds)
    for si, s in enumerate(plans):
        for w in s.words:
            sounds = [x for x in scores[si] if w.start <= x.phoneme < w.end]
            if not sounds:
                continue
            start = timings[si][w.start][0] if timings else sounds[0].frame * FRAME
            words.append((w.text, float(np.mean([x.frame for x in sounds])) * FRAME))
            problem = not_heard(sounds)
            if problem:
                out.append(Finding("not-heard", "error", w.text, f"the listener did not hear {problem}", round(start, 2), {"sounds": _sounds(sounds)}))
    if words and extra:
        middles = np.array([m for _, m in words])
        near: dict[int, list] = {}
        for e in extra:
            near.setdefault(int(np.argmin(np.abs(middles - e.frame * FRAME))), []).append(e)
        for k, found in near.items():
            if len(found) >= EXTRA:
                out.append(
                    Finding("extra", "error", words[k][0], "the listener heard sounds that were not planned: " + " ".join(e.label for e in found), round(found[0].frame * FRAME, 2))
                )
    return out


_VOWEL_LETTERS = set("".join(VOWELS))


def sound_lengths(phonemes: list[str], timing: list[tuple[float, float]], start: int, end: int) -> list[tuple[str, float, float]]:
    """(sound, start, seconds) for the letters of a word; a stress mark counts with the sound after it, ː and ʲ before."""
    out: list[list] = []
    carry = 0.0
    for i in range(start, end):
        p, length = phonemes[i], timing[i][1] - timing[i][0]
        if p in "ˈˌ":
            carry += length
        elif p in "ːʲ" and out:
            out[-1][2] += length
        elif p.isalpha():
            out.append([p, timing[i][0] - carry, length + carry])
            carry = 0.0
    return [(p, at, length) for p, at, length in out]


def not_heard(sounds: list[SoundScore]) -> str:
    """What was not heard in a word (empty when it was heard well enough)."""
    required = [x for x in sounds if not x.optional]
    vowels = [x for x in required if x.unit in VOWELS and x.score < VOWEL]
    consonants = [x for x in required if x.unit not in VOWELS and x.score < CONSONANT]
    if vowels:
        return "the vowel " + ", ".join(x.unit for x in vowels)
    if len(consonants) >= CONSONANTS_LOW:
        return "the sounds " + ", ".join(x.unit for x in consonants)
    # the average says something only with a few sounds: in "hier" one weak h would be half of it
    if len(required) >= 3 and float(np.mean([x.score for x in required])) < MEAN:
        return "the word clearly (" + " ".join(x.unit for x in required) + ")"
    return ""


def _sounds(sounds: list[SoundScore]) -> list[list]:
    return [[x.unit, round(x.score, 1)] + (["optional"] if x.optional else []) for x in sounds]


def penalty(findings: list[Finding]) -> int:
    """How bad a take is, to choose between takes: errors weigh more than warnings."""
    return sum(10 if f.severity == "error" else 1 for f in findings if not f.on_plan)
