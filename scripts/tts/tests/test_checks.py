import unittest
from collections import defaultdict

from pronunciation.checks import Finding, Lists, PlanChecker, check_timing, not_heard, penalty, sound_lengths
from pronunciation.dictionary import Dictionary, classes
from pronunciation.listener import SoundScore
from pronunciation.phonemes import Planner
from pronunciation.report import Line, Report


def dictionary(entries: dict[str, list[str]]) -> Dictionary:
    d = Dictionary.__new__(Dictionary)  # without the downloaded file
    d.entries = defaultdict(list, {w: [p.replace(" ", "") for p in ps] for w, ps in entries.items()})
    return d


LISTS = Lists({"verzekering": "vərzˈeːkərɪŋ", "-tje": "tʲə"}, {"plastic"}, {"tee", "em", "bee", "oo"})


class DictionaryTest(unittest.TestCase):
    def test_notation_is_not_a_difference(self):
        self.assertEqual(classes("ˈɛɪndə"), classes("ɛi̯ndə"))
        self.assertEqual(classes("ʋˈɑt"), classes("wɑd"))  # ʋ or w, a final d or t
        self.assertEqual(classes("mˈoːj"), classes("moːi̯"))  # the glide in "mooi"
        self.assertEqual(classes("ˈoːrɑɲə"), classes("oːrɑnjə"))

    def test_finds_a_vowel_or_stress_espeak_gets_wrong(self):
        d = dictionary({"app": ["ɛ p"], "meneer": ["m ə n eː r"], "hoi": ["ɦ ɔ i̯"], "kat": ["k ɑ t"]})
        self.assertIsNotNone(d.disagrees("app", "ˈɑp"))  # one vowel, but another one
        self.assertIsNotNone(d.disagrees("meneer", "meːnˈɪr"))
        self.assertIsNone(d.disagrees("hoi", "hˈoːi"))  # only a long or short o
        self.assertIsNone(d.disagrees("kat", "kˈɑt"))
        self.assertIsNone(d.disagrees("onbekend", "ˈɔnbəkˌɛnt"))  # not in the dictionary


class PlanCheckerTest(unittest.TestCase):
    def check(self, text: str, d: Dictionary | None = None) -> list[tuple[str, str]]:
        planner = Planner("nl")
        return [(f.check, f.word) for f in PlanChecker(planner, LISTS, d).check(planner.plan(text), set())]

    def test_finds_a_word_espeak_spells(self):
        self.assertIn(("spelled", "be"), self.check("Woorden met be, zoals bericht."))

    def test_letter_names_are_spelled_on_purpose(self):
        self.assertEqual(self.check("Op de pee em bee oo."), [])

    def test_finds_a_word_in_another_language(self):
        self.assertIn(("foreign", "website"), self.check("Kijk op de website."))

    def test_finds_a_word_the_dictionary_says_differently_unless_espeak_is_right(self):
        d = dictionary({"app": ["ɛ p"], "plastic": ["p l ɛ s t ɪ k"]})
        found = self.check("De app is van plastic.", d)
        self.assertIn(("dictionary", "app"), found)
        self.assertNotIn(("dictionary", "plastic"), found)

    def test_finds_an_ee_before_r_that_espeak_says_short(self):
        found = self.check("Wanneer studeert hij? Meer weet ik niet.")
        self.assertIn(("short-eer", "Wanneer"), found)
        self.assertIn(("short-eer", "studeert"), found)
        self.assertNotIn(("short-eer", "Meer"), found)  # espeak says this one long

    def test_warns_about_a_longer_word_with_a_listed_word_in_it(self):
        self.assertIn(("contains", "verzekeringspas"), self.check("Waar is je verzekeringspas?"))
        self.assertNotIn("contains", [c for c, _ in self.check("Het meisje zingt.")])  # a word part does not count

    def test_reports_phonemes_the_voice_cannot_say(self):
        planner = Planner("nl")
        found = PlanChecker(planner, LISTS, None).check(planner.plan("Ja."), {"ʘ"})
        self.assertEqual([f.check for f in found], ["unknown-phoneme"])


class SoundRulesTest(unittest.TestCase):
    def sounds(self, *scores: tuple[str, float, bool]) -> list[SoundScore]:
        return [SoundScore(u, i, i, s, o) for i, (u, s, o) in enumerate(scores)]

    def test_a_vowel_not_heard_is_enough(self):
        self.assertIn("aː", not_heard(self.sounds(("m", -0.1, False), ("aː", -9.0, False), ("n", -0.2, False))))

    def test_one_weak_consonant_is_not_enough_but_two_are(self):
        self.assertEqual(not_heard(self.sounds(("h", -0.1, False), ("œy", -0.3, False), ("s", -6.0, False))), "")
        self.assertNotEqual(not_heard(self.sounds(("t", -9.0, False), ("ɛ", -0.3, False), ("k", -9.0, False))), "")

    def test_a_word_heard_only_vaguely_counts(self):
        # each sound on its own would pass, but together the word was hardly there
        self.assertNotEqual(not_heard(self.sounds(("d", -3.5, False), ("u", -4.0, False), ("n", -3.5, False))), "")
        self.assertEqual(not_heard(self.sounds(("d", -1.0, False), ("u", -2.0, False), ("n", -1.0, False))), "")

    def test_optional_sounds_never_count(self):
        self.assertEqual(not_heard(self.sounds(("l", -0.1, False), ("oː", -0.2, False), ("ə", -12.0, True), ("n", -12.0, True))), "")

    def test_a_sound_held_too_long(self):
        phonemes = list("ʋˈaːr")
        timing = [(0.0, 0.05), (0.05, 0.06), (0.06, 0.5), (0.5, 0.9), (0.9, 0.95)]
        self.assertEqual([(p, round(l, 2)) for p, _, l in sound_lengths(phonemes, timing, 0, 5)], [("ʋ", 0.05), ("a", 0.85), ("r", 0.05)])

        class Plan:
            words = [type("W", (), {"text": "waar", "start": 0, "end": 5})()]

        Plan.phonemes = phonemes
        self.assertEqual([f.word for f in check_timing([Plan], [timing], 1.0)], ["waar"])
        self.assertEqual(check_timing([Plan], [[(0, 0.05), (0.05, 0.06), (0.06, 0.2), (0.2, 0.3), (0.3, 0.35)]], 1.0), [])

    def test_a_word_reviewed_as_right_in_a_voice_is_not_reported_for_that_voice(self):
        lists = Lists({}, set(), set(), {"nl_NL-ronnie-medium": {"elke"}})
        found = [Finding("not-heard", "error", "Elke", "…"), Finding("not-heard", "error", "dag", "…"), Finding("dictionary", "error", "elke", "…")]
        self.assertEqual([(f.check, f.word) for f in lists.without_heard_right("nl_NL-ronnie-medium", found)], [("not-heard", "dag"), ("dictionary", "elke")])
        self.assertEqual(len(lists.without_heard_right("nl_NL-alex-medium", found)), 3)

    def test_a_finding_comes_back_the_same_from_the_cache(self):
        for f in [Finding("too-short", "error", "", "cut off"), Finding("not-heard", "error", "uur", "…", 4.16, {"sounds": [["y", -0.7]]})]:
            self.assertEqual(Finding(**f.to_json()), f)

    def test_a_take_with_an_error_weighs_more_than_one_with_warnings(self):
        error = [Finding("not-heard", "error", "a", "")]
        warnings = [Finding("drawn-out", "warning", "a", "")] * 3
        self.assertGreater(penalty(error), penalty(warnings))
        self.assertEqual(penalty([Finding("dictionary", "error", "a", "")]), 0)  # the plan is the same in every take


class ReportTest(unittest.TestCase):
    def test_lists_each_word_once_and_marks_it_on_the_page(self):
        report = Report()
        dict_finding = Finding("dictionary", "error", "app", "espeak says ɑp")
        report.add(Line("k1", "De app <b>is</b> gratis.", "alex", "public/audio/voice/k1.m4a", 0.0, [dict_finding]))
        report.add(Line("k2", "Een app.", "alex", "public/audio/voice/k2.m4a", 0.0, [dict_finding]))
        report.add(Line("k3", "Niets.", "alex", "public/audio/voice/k3.m4a", 0.0, []))
        self.assertEqual(report.summary().count('"app"'), 1)
        self.assertEqual(report.errors(), 2)
        from pathlib import Path
        import tempfile

        with tempfile.TemporaryDirectory() as tmp:
            page = report.write(Path(tmp) / "check", Path(tmp)).read_text()
        self.assertIn("De <mark>app</mark> &lt;b&gt;is&lt;/b&gt; gratis.", page)
        self.assertNotIn("k3", page)


if __name__ == "__main__":
    unittest.main()
