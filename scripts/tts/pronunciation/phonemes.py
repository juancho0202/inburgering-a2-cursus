"""
What Piper is asked to say: the phonemes of each sentence, and which word each phoneme belongs to.

Piper turns text into phonemes with espeak-ng, one sentence at a time. This does the same (the phonemes are exactly
the ones Piper would use), but also keeps
  - which word of the text each phoneme belongs to, so a problem in the sound can be pinned to a word;
  - whether espeak switched to another language for a word (Piper drops that silently);
  - [[phonemes]] blocks (words from PRONUNCIATIONS) with the punctuation and spaces around them. Piper 1.8 has
    [[ ]] too, but drops the comma or full stop after a block and glues the next word to it ("vər hət" becomes
    "vərhət"), so the voice runs on where it should pause.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from piper import espeakbridge
from piper.phonemize_espeak import ESPEAK_DATA_DIR

_RAW = re.compile(r"\[\[(.*?)\]\]")
_LANGUAGE_FLAG = re.compile(r"\(([a-z-]+)\)")
# A word as espeak sees it: letters, digits and what joins them ("auto's", "10.30", "e-mail").
_TOKEN = re.compile(r"[\w'’]+(?:[.,:\-][\w'’]+)*", re.UNICODE)
_PAUSES = ",:;"
_ENDS = ".!?"
STRESS = "ˈˌ"

_ready = False


def espeak(voice: str, text: str) -> list[tuple[str, str, bool]]:
    """espeak's clauses for a text: (phonemes with language flags, terminator, end of sentence)."""
    global _ready
    if not _ready:
        espeakbridge.initialize(str(ESPEAK_DATA_DIR))
        _ready = True
    espeakbridge.set_voice(voice)
    return espeakbridge.get_phonemes(text)


def word_phonemes(voice: str, word: str) -> str:
    """One word on its own, as espeak says it (without language flags)."""
    return " ".join(_LANGUAGE_FLAG.sub("", p) for p, _, _ in espeak(voice, word)).strip()


@dataclass
class Word:
    text: str
    """The word as written ("gesprek", "10.30"); for a [[ ]] block, the word it stands for when known."""
    start: int
    """Index of its first phoneme in the sentence."""
    end: int
    """Index after its last phoneme."""
    phonemes: str
    source: str = "espeak"
    """"espeak", or "lexicon" for a [[ ]] block."""
    language: str | None = None
    """The language espeak switched to for this word ("en"), if it did."""
    owner: int = -1
    """Which token of its text part this is (-1: espeak split the part differently, so the word is the whole part)."""
    part: int = 0
    """Which text part it came from (to keep tokens of different parts apart)."""


@dataclass
class Sentence:
    phonemes: list[str] = field(default_factory=list)
    """What Piper's model is given: one entry per code point, as Piper's own phonemiser makes them."""
    words: list[Word] = field(default_factory=list)


class Planner:
    """Makes the plan for a text; `voice` is the espeak voice of the Piper model ("nl")."""

    def __init__(self, voice: str):
        self.voice = voice
        self._counts: dict[str, int] = {}

    def _word_count(self, token: str) -> int:
        """How many words espeak makes of a token on its own ("10.30" is "tien dertig": two)."""
        if token not in self._counts:
            self._counts[token] = len(word_phonemes(self.voice, token).split())
        return self._counts[token]

    def plan(self, text: str, written: str | None = None) -> list[Sentence]:
        """
        The sentences of `text` (what Piper is given, with [[ ]] blocks). `written` is the same text without the
        blocks (the speakable text), used to name the word a block stands for.
        """
        names = _block_names(text, written)
        out = _Builder()
        parts = _RAW.split(text)
        for i, part in enumerate(parts):
            if i % 2 == 1:
                # a [[ ]] block: a space before it when the text has one there
                if parts[i - 1][-1:].isspace():
                    out.space()
                start = len(out.sentence.phonemes)
                out.add(part.strip())
                out.sentence.words.append(Word(names[i // 2], start, len(out.sentence.phonemes), part.strip(), "lexicon"))
                continue
            if i > 0:
                # punctuation right after a block belongs to its sentence (espeak gets no word to hang it on)
                lead = re.match(r"\s*([,:;.!?…]*)", part)
                assert lead
                for sign in lead.group(1):
                    if sign in _PAUSES:
                        out.add(sign + " ")
                    elif sign in _ENDS:
                        out.add(sign)
                        out.close()
                rest = part[lead.end() :]
                # a space or a sign between the block and the next word: they are two words
                if rest and lead.group(0):
                    out.space()
                part = rest
            if part.strip():
                self._espeak_part(part, out, i)
        out.close()
        return out.sentences

    def _espeak_part(self, part: str, out: "_Builder", index: int) -> None:
        """Phonemes for plain text, word by word, the way Piper's EspeakPhonemizer puts them together."""
        tokens = [t for t in _TOKEN.findall(part) if any(c.isalnum() for c in t)]
        counts = [self._word_count(t) for t in tokens]
        clauses = espeak(self.voice, part)
        spoken = [w for p, _, _ in clauses for w in _LANGUAGE_FLAG.sub(" ", p).split()]
        # Each token gets as many of espeak's words as it makes on its own. When espeak joins or splits words
        # differently in the sentence, the whole part becomes one "word": coarser, but never pinned wrongly.
        exact = sum(counts) == len(spoken)
        # the token each of espeak's words belongs to (its index; -1 for "the whole part")
        owners = [k for k, n in enumerate(counts) for _ in range(n)] if exact else [-1] * len(spoken)
        names = tokens if exact else []
        n = 0
        for phonemes, terminator, end in clauses:
            for w, language in _flagged_words(phonemes):
                out.space()
                sentence = out.sentence
                start = len(sentence.phonemes)
                out.add(w)
                owner = owners[n] if n < len(owners) else -1
                n += 1
                last = sentence.words[-1] if sentence.words else None
                if last and last.source == "espeak" and last.owner == owner and last.part == index:
                    # another word of the same token ("10.30" is "tien dertig")
                    last.end, last.phonemes = len(sentence.phonemes), f"{last.phonemes} {w}"
                    last.language = last.language or language
                else:
                    text = names[owner] if owner >= 0 else part.strip()
                    sentence.words.append(Word(text, start, len(sentence.phonemes), w, "espeak", language, owner, index))
            out.add(terminator)
            if terminator in _PAUSES:
                out.add(" ")
            # Without a terminator this is only the end of the part (a [[ ]] block follows), not of a sentence.
            if end and terminator:
                out.close()


class _Builder:
    """The sentences so far and the one being built."""

    def __init__(self) -> None:
        self.sentences: list[Sentence] = []
        self.sentence = Sentence()

    def add(self, s: str) -> None:
        self.sentence.phonemes.extend(unicodedata.normalize("NFD", s))

    def space(self) -> None:
        """A space between words; none at the start of a sentence or after one."""
        if self.sentence.phonemes and self.sentence.phonemes[-1] != " ":
            self.sentence.phonemes.append(" ")

    def close(self) -> None:
        if self.sentence.phonemes:
            while self.sentence.phonemes and self.sentence.phonemes[-1] == " ":
                self.sentence.phonemes.pop()
            self.sentences.append(self.sentence)
        self.sentence = Sentence()


def _flagged_words(phonemes: str) -> list[tuple[str, str | None]]:
    """espeak's words with the language each is in: "(en)wˈɛbsaɪt(nl)" is ("wˈɛbsaɪt", "en")."""
    words: list[tuple[str, str | None]] = []
    language: str | None = None
    for piece in re.split(r"(\([a-z-]+\))", phonemes):
        flag = _LANGUAGE_FLAG.fullmatch(piece)
        if flag:
            # espeak switches back with the voice's own flag
            language = None if language else flag.group(1)
            continue
        for w in piece.split():
            words.append((w, language))
    return words


def _block_names(text: str, written: str | None) -> list[str]:
    """The written word for each [[ ]] block, by matching the text around the blocks against `written`."""
    blocks = _RAW.findall(text)
    if not written:
        return [f"[[{b}]]" for b in blocks]
    pattern = "".join(re.escape(p) if i % 2 == 0 else "(.+?)" for i, p in enumerate(_RAW.split(text)))
    m = re.fullmatch(pattern, written, flags=re.DOTALL)
    return list(m.groups()) if m else [f"[[{b}]]" for b in blocks]


def without_stress(phonemes: str) -> str:
    return "".join(c for c in phonemes if c not in STRESS)
