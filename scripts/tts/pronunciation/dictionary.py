"""
A second opinion on espeak: a Dutch pronunciation dictionary (WikiPron, pronunciations from Wiktionary).

espeak builds a word's phonemes from spelling rules and a small exception list, so it gets stress and loanwords wrong
("meneer" as mee-NIER, "inburgeren" as in-bur-GEER-en, "app" as ap). Where the dictionary has the word, its
pronunciation is compared with espeak's after both are reduced to coarse sound classes, so notation (ʋ or v, ɛi
or ɛɪ, a final d or t) does not count and only a different sound or stress-driven vowel does.

The file is downloaded once (scripts/tts/README.md) and checked against SHA256; it is never shipped with the app.
"""

from __future__ import annotations

import hashlib
import unicodedata
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

# WikiPron's Dutch "broad" list at a fixed commit (Apache-2.0 code; the data is from Wiktionary, CC BY-SA).
SOURCE = "https://raw.githubusercontent.com/CUNY-CL/wikipron/d282e848a211ea31cfd730f0ced8bc8cdab9e83d/data/scrape/tsv/nld_latn_broad.tsv"
SHA256 = "1cdb0c53a8f8fec58900e0400e2c563d5b98915e0bc3b9d090fa7d775ef216a1"

# Sounds to classes, longest first. Pairs that Dutch speakers (and the two notations) do not keep apart share a
# class: a final d and t, v and f, z and s, g and ch, ʋ and w; the glide in "nieuw" or "mooi" is a consonant.
_CLASSES = [
    ("ɛi̯", "EI"), ("ɛɪ", "EI"), ("ɛi", "EI"), ("ɑi̯", "AI"), ("aɪ", "AI"), ("ɑj", "AI"),
    ("œy̯", "UI"), ("œy", "UI"), ("ʌʊ", "OU"), ("ɑu̯", "OU"), ("ɑu", "OU"), ("ɔu̯", "OU"), ("ɔu", "OU"), ("aʊ", "OU"),
    ("yʊ", "Y W"), ("eʊ", "E: W"), ("u̯", "W"), ("i̯", "J"),
    ("eː", "E:"), ("ɪː", "E:"), ("e", "E:"), ("oː", "O:"), ("ɔː", "O:"), ("o", "O:"), ("øː", "EU"), ("ø", "EU"),
    ("aː", "A:"), ("a", "A:"), ("yː", "Y"), ("y", "Y"), ("iː", "I:"), ("i", "I:"), ("uː", "U"), ("u", "U"),
    ("ɑ", "A"), ("ɛ", "E"), ("ɪ", "I"), ("ɔ", "O"), ("ʏ", "UU"), ("ɵ", "UU"), ("ə", "@"), ("ɐ", "@"),
    ("tʲ", "C"), ("tʃ", "C"), ("c", "C"), ("tj", "C"), ("ɲ", "N J"), ("ʋ", "W"), ("w", "W"), ("β", "W"),
    ("v", "F"), ("f", "F"), ("z", "S"), ("s", "S"), ("ɣ", "X"), ("x", "X"), ("ɡ", "X"), ("g", "X"), ("χ", "X"),
    ("ɦ", "H"), ("h", "H"), ("d", "T"), ("t", "T"), ("b", "P"), ("p", "P"), ("ʒ", "SJ"), ("ʃ", "SJ"),
    ("ɹ", "R"), ("ʁ", "R"), ("r", "R"), ("ɾ", "R"), ("k", "K"), ("l", "L"), ("m", "M"), ("n", "N"), ("ŋ", "NG"), ("j", "J"),
]
_DROPPED = set("ˈˌːˑ.‿͡ʔ- ")
# Vowel classes of one family: a single swap between them (a long or short o) is not reported on its own.
_FAMILY = {"A": "a", "A:": "a", "E": "e", "E:": "e", "I": "i", "I:": "i", "O": "o", "O:": "o", "U": "u", "UU": "y", "Y": "y", "EU": "y"}


def classes(phonemes: str) -> list[str]:
    s = unicodedata.normalize("NFC", phonemes)
    out: list[str] = []
    i = 0
    while i < len(s):
        for sound, cls in _CLASSES:
            if s.startswith(sound, i):
                out.extend(cls.split())
                i += len(sound)
                break
        else:
            if s[i] not in _DROPPED and not unicodedata.category(s[i]).startswith("M"):
                out.append(f"?{s[i]}")
            i += 1
    # a vowel right after another vowel is a glide ("hoi" is h-o-j)
    vowels = {"A", "A:", "E", "E:", "I", "I:", "O", "O:", "U", "UU", "Y", "EU", "@"}
    return [("J" if c == "I:" else "W" if c == "U" else c) if k and out[k - 1] in vowels and c in ("I:", "U") else c for k, c in enumerate(out)]


def _distance(a: list[str], b: list[str]) -> tuple[int, list[tuple[str, str]]]:
    """Edit distance, and the substitutions on one cheapest path."""
    rows = [[(j, []) for j in range(len(b) + 1)]]
    for i, x in enumerate(a, 1):
        row = [(i, [])]
        for j, y in enumerate(b, 1):
            options = [
                (rows[-1][j][0] + 1, rows[-1][j][1]),
                (row[j - 1][0] + 1, row[j - 1][1]),
                (rows[-1][j - 1][0] + (x != y), rows[-1][j - 1][1] + ([(x, y)] if x != y else [])),
            ]
            row.append(min(options, key=lambda o: o[0]))
        rows.append(row)
    return rows[-1][-1]


@dataclass
class Disagreement:
    word: str
    espeak: str
    dictionary: str
    distance: int


class Dictionary:
    def __init__(self, path: Path):
        data = path.read_bytes()
        if hashlib.sha256(data).hexdigest() != SHA256:
            raise ValueError(f"{path} is not the expected WikiPron list (SHA256 differs); download it again ({SOURCE})")
        self.entries: dict[str, list[str]] = defaultdict(list)
        for line in data.decode("utf-8").splitlines():
            word, _, pronunciation = line.partition("\t")
            self.entries[word].append(pronunciation.replace(" ", ""))

    def __contains__(self, word: str) -> bool:
        return word in self.entries

    def disagrees(self, word: str, espeak: str) -> Disagreement | None:
        """espeak's pronunciation of `word` when it is clearly not one of the dictionary's, else None."""
        if word not in self.entries:
            return None
        mine = classes(espeak)
        best = min(((*_distance(mine, classes(p)), p) for p in self.entries[word]), key=lambda x: x[0])
        distance, swaps, theirs = best
        if distance == 0:
            return None
        # One difference counts only when it swaps two different vowels ("app": ɑ for ɛ); a single consonant or a
        # long for a short vowel of the same family is notation or a variant more often than an error.
        if distance == 1 and not (swaps and all(x in _FAMILY and y in _FAMILY and _FAMILY[x] != _FAMILY[y] for x, y in swaps)):
            return None
        return Disagreement(word, espeak, theirs, distance)
