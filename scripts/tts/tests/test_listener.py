import unittest

import numpy as np

from pronunciation.checks import check_take
from pronunciation.listener import BLANK, force_align, optional, resample
from pronunciation.seeded import Scales

from .helpers import listener, needs_listener, voice


def log_probs(path: list[int], labels: int = 5, sure: float = 0.97) -> np.ndarray:
    """Frames that each say one label clearly."""
    lp = np.full((len(path), labels), np.log((1 - sure) / (labels - 1)))
    lp[np.arange(len(path)), path] = np.log(sure)
    return lp


class ForceAlignTest(unittest.TestCase):
    def test_finds_where_each_label_is_said(self):
        lp = log_probs([BLANK, 2, 2, BLANK, 3, BLANK, BLANK, 2, BLANK])
        self.assertEqual(force_align(lp, [2, 3, 2]).tolist(), [1, 4, 7])

    def test_a_repeated_label_needs_a_blank_between(self):
        lp = log_probs([BLANK, 2, BLANK, 2, BLANK])
        self.assertEqual(force_align(lp, [2, 2]).tolist(), [1, 3])

    def test_a_band_keeps_a_label_near_its_planned_moment(self):
        # label 2 is said clearly at frame 1, but planned for frames 5..8 (where only a weak trace of it is)
        lp = log_probs([BLANK, 2, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK, BLANK])
        self.assertEqual(force_align(lp, [2]).tolist(), [1])
        self.assertEqual(force_align(lp, [2], [(5, 8)])[0] in range(5, 8), True)

    def test_none_when_the_audio_is_too_short_for_the_labels(self):
        self.assertIsNone(force_align(log_probs([2, 3]), [2, 3, 4]))


class ResampleTest(unittest.TestCase):
    def test_keeps_the_pitch_and_the_length(self):
        t = np.arange(22050) / 22050
        y = resample(np.sin(2 * np.pi * 440 * t), 22050, 16000)
        self.assertEqual(len(y), 16000)
        self.assertEqual(int(np.argmax(np.abs(np.fft.rfft(y)))), 440)


class OptionalTest(unittest.TestCase):
    def test_sounds_fluent_dutch_leaves_out(self):
        het = list("hət")
        self.assertTrue(optional(het, 0, 3, 0, "h"))  # "het" unstressed is [ət]
        self.assertFalse(optional(list("hˈœys"), 0, 5, 0, "h"))  # "huis" keeps its h
        self.assertTrue(optional(list("stˈɔpt hˈir"), 7, 11, 7, "h"))  # "stopt hier": after a consonant
        self.assertFalse(optional(list("dˈi hˈir"), 4, 8, 4, "h"))  # "die hier": after a vowel it stays
        lopen = list("lˈoːpən")
        self.assertTrue(optional(lopen, 0, 7, 6, "n"))  # the n of a final -en
        self.assertFalse(optional(list("mˈaːn"), 0, 5, 4, "n"))
        self.assertTrue(optional(lopen, 0, 7, 5, "ə"))
        self.assertTrue(optional(list("ˈyr"), 0, 3, 2, "r"))  # "uur": a vowel-like r after a long vowel
        self.assertTrue(optional(list("lˈɪːrplɪxt"), 0, 10, 4, "r"))
        self.assertFalse(optional(list("mˈɔrɣən"), 0, 7, 3, "r"))  # after a short vowel the r stays
        self.assertFalse(optional(list("rˈaːt"), 0, 5, 0, "r"))
        self.assertTrue(optional(list("ˈɑmbtənˌaːr"), 0, 11, 3, "b"))  # "ambtenaar" is [ɑmtənaːr]
        self.assertFalse(optional(list("ˈɑmbər"), 0, 6, 3, "b"))
        self.assertTrue(optional(list("sˈɔɾri"), 0, 6, 4, "r"))  # espeak's double r in "sorry" is one


@needs_listener
class ListenerTest(unittest.TestCase):
    """The listener on real takes: what the checks rely on."""

    def take(self, text: str, seed: int = 3):
        v = voice()
        return v.say(v.planner.plan(text), seed, Scales(1.1))

    def test_hears_a_clear_line_as_planned(self):
        found = check_take(self.take("De bibliotheek is morgen open."), listener(), 1.1)
        self.assertEqual([f for f in found if f.severity == "error"], [])

    def test_does_not_hear_a_word_that_is_missing(self):
        take = self.take("De bibliotheek is morgen open.")
        sentence = take.sentences[0]
        word = next(w for w in sentence.plan.words if w.text == "morgen")
        a, b = sentence.span(word.start, word.end)
        take.audio[a:b] = 0.0
        found = check_take(take, listener(), 1.1)
        self.assertIn(("not-heard", "morgen"), [(f.check, f.word) for f in found])

    def test_does_not_hear_the_end_of_a_take_that_was_cut_off(self):
        take = self.take("Ik woon in Amsterdam.")
        sentence = take.sentences[0]
        word = next(w for w in sentence.plan.words if w.text == "Amsterdam")
        a, _ = sentence.span(word.start, word.end)
        take.audio = take.audio[: a + 1000]
        found = check_take(take, listener(), 1.1)
        self.assertIn("Amsterdam", [f.word for f in found if f.severity == "error"])

    def test_scores_are_the_same_every_time(self):
        take = self.take("Waar is het station?")
        a = listener().hear(take.audio, take.sample_rate).log_probs
        b = listener().hear(take.audio, take.sample_rate).log_probs
        self.assertTrue(np.array_equal(a, b))


if __name__ == "__main__":
    unittest.main()
