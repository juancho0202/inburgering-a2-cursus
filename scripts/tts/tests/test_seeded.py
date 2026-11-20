import unittest

import numpy as np

import pronunciation.seeded as seeded
from pronunciation.phonemes import PAUSE_SECONDS
from pronunciation.seeded import Scales, seed_for

from .helpers import needs_voice, voice


def longest_silence(x: np.ndarray) -> int:
    """The longest run of samples that are exactly 0."""
    best = run = 0
    for v in x:
        run = run + 1 if v == 0 else 0
        best = max(best, run)
    return best


@needs_voice
class SeededVoiceTest(unittest.TestCase):
    def say(self, text: str, seed: int, length: float = 1.1):
        v = voice()
        return v.say(v.planner.plan(text), seed, Scales(length))

    def test_the_same_seed_says_it_the_same_way(self):
        a, b = self.say("Hoe laat is het?", 7), self.say("Hoe laat is het?", 7)
        self.assertTrue(np.array_equal(a.audio, b.audio))

    def test_another_seed_is_another_take(self):
        a, b = self.say("Hoe laat is het?", 7), self.say("Hoe laat is het?", 8)
        self.assertFalse(len(a.audio) == len(b.audio) and np.array_equal(a.audio, b.audio))

    def test_a_slow_line_that_needs_a_bigger_noise_buffer_sounds_the_same(self):
        first = self.say("Ja.", 5, length=4.0)
        guess = seeded._FRAMES_PER_ID
        try:
            seeded._FRAMES_PER_ID = 1  # forces the buffer to grow
            self.assertTrue(np.array_equal(self.say("Ja.", 5, length=4.0).audio, first.audio))
        finally:
            seeded._FRAMES_PER_ID = guess

    def test_the_timings_cover_the_take_in_order(self):
        take = self.say("Eerst dit. Dan dat, en klaar.", 1)
        self.assertEqual(len(take.sentences), 2)
        for sentence, timing in zip(take.sentences, take.timings()):
            self.assertEqual(len(timing), len(sentence.plan.phonemes))
            starts = [a for a, _ in timing]
            self.assertEqual(starts, sorted(starts))
            self.assertLessEqual(timing[-1][1], len(take.audio) / take.sample_rate)
        # the second sentence starts where the first one's audio ends
        self.assertGreaterEqual(take.timings()[1][0][0], take.sentences[1].start / take.sample_rate)

    def test_a_pause_is_silence_of_its_length_where_the_plan_puts_it(self):
        v = voice()
        [plan] = v.planner.plan("[[‖ˈɔf‖]] en meer", "-of en meer")
        [without] = v.planner.plan("[[ˈɔf]], en meer")
        self.assertEqual(list(plan.pauses), [3])
        take, plain = v.say([plan], 3, Scales(1.1)), v.say([without], 3, Scales(1.1))
        a, b = take.timings()[0][3]
        a0, b0 = plain.timings()[0][3]
        # the comma lasts the added frames longer, everything else is said as before
        added = round(PAUSE_SECONDS * v.sample_rate / v.hop) * v.hop / v.sample_rate
        self.assertAlmostEqual((b - a) - (b0 - a0), added, places=3)
        # the added frames are silent, apart from the fades at their ends: the model alone would hold the f
        fade = 2 * int(seeded._FADE * v.sample_rate)
        self.assertGreaterEqual(longest_silence(take.audio[int(a * v.sample_rate) : int(b * v.sample_rate)]), added * v.sample_rate - fade - 1)
        self.assertLess(longest_silence(plain.audio[int(a0 * v.sample_rate) : int(b0 * v.sample_rate)]), 100)

    def test_a_slower_phoneme_lasts_longer(self):
        v = voice()
        [plan] = v.planner.plan("[[ˈɔf]] en meer")
        [slow] = v.planner.plan("[[ˈɔf]] en meer")
        slow.slower = {i: 2.0 for i in range(3)}
        fast, slower = v.say([plan], 3, Scales(1.1)), v.say([slow], 3, Scales(1.1))
        length = lambda take, i: take.sentences[0].phoneme_samples[i]
        self.assertGreater(sum(length(slower, i) for i in range(3)), 1.6 * sum(length(fast, i) for i in range(3)))
        self.assertEqual([length(slower, i) for i in range(3, 8)], [length(fast, i) for i in range(3, 8)])

    def test_seeds_differ_per_line_and_take_but_not_per_run(self):
        self.assertEqual(seed_for("abc", 0), seed_for("abc", 0))
        self.assertEqual(len({seed_for("abc", 0), seed_for("abc", 1), seed_for("abd", 0)}), 3)

    def test_knows_which_phonemes_the_voice_cannot_say(self):
        v = voice()
        self.assertEqual(v.missing_phonemes(v.planner.plan("[[ʘa]]")), {"ʘ"} - set(v.config.phoneme_id_map))


if __name__ == "__main__":
    unittest.main()
