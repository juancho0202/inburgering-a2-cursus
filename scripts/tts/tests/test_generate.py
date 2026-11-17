import tempfile
import unittest
from pathlib import Path

import generate
from generate import Checked, plan_id
from pronunciation.checks import Finding
from pronunciation.phonemes import Sentence


class CheckedTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.path = Path(self.tmp.name) / "checked.json"

    def tearDown(self):
        self.tmp.cleanup()

    def test_keeps_the_sound_findings_across_runs_but_not_the_plans(self):
        c = Checked(self.path)
        c.put("k1", [Finding("not-heard", "error", "uur", "…", 4.2), Finding("dictionary", "error", "app", "…")], 1, 1.1, "p1")
        c.save()
        again = Checked(self.path)
        self.assertEqual([f.check for f in again.get("k1")], ["not-heard"])

    def test_findings_of_another_check_version_are_made_again(self):
        c = Checked(self.path)
        c.put("k1", [], 0, 1.1, "p1")
        version = generate.CHECK_VERSION
        try:
            generate.CHECK_VERSION = version + 1
            self.assertIsNone(c.get("k1"))
        finally:
            generate.CHECK_VERSION = version

    def test_says_a_take_again_only_when_that_gives_the_same_audio(self):
        c = Checked(self.path)
        c.put("k1", [], 2, 1.1, "p1")
        c.put("old", [])
        self.assertEqual(c.take("k1", 1.1, "p1"), 2)
        self.assertIsNone(c.take("k1", 1.2, "p1"))  # another pace
        self.assertIsNone(c.take("k1", 1.1, "p2"))  # other phonemes (espeak, the planner or a pronunciation changed)
        self.assertIsNone(c.take("old", 1.1, "p1"))  # recorded before the check
        self.assertTrue(c.recorded_with_checks("k1"))
        self.assertFalse(c.recorded_with_checks("old"))

    def test_forgets_recordings_that_are_gone_with_their_fragment_lines(self):
        c = Checked(self.path)
        for key in ["a", "b", "frag#0", "frag#1", "gone#0"]:
            c.put(key, [])
        c.keep_only({"a", "frag"})
        self.assertEqual(sorted(c.data), ["a", "frag#0", "frag#1"])

    def test_a_plan_is_named_by_its_phonemes(self):
        one, other = Sentence(list("ja.")), Sentence(list("nee."))
        self.assertEqual(plan_id([one]), plan_id([Sentence(list("ja."))]))
        self.assertNotEqual(plan_id([one]), plan_id([other]))
        self.assertNotEqual(plan_id([one, other]), plan_id([Sentence(list("ja.nee."))]))


if __name__ == "__main__":
    unittest.main()
