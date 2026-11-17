import unittest

import numpy as np

import pronunciation.seeded as seeded
from pronunciation.seeded import Scales, seed_for

from .helpers import needs_voice, voice


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

    def test_seeds_differ_per_line_and_take_but_not_per_run(self):
        self.assertEqual(seed_for("abc", 0), seed_for("abc", 0))
        self.assertEqual(len({seed_for("abc", 0), seed_for("abc", 1), seed_for("abd", 0)}), 3)

    def test_knows_which_phonemes_the_voice_cannot_say(self):
        v = voice()
        self.assertEqual(v.missing_phonemes(v.planner.plan("[[ʘa]]")), {"ʘ"} - set(v.config.phoneme_id_map))


if __name__ == "__main__":
    unittest.main()
