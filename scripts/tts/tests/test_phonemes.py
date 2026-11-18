import unittest

from piper import PiperVoice

from pronunciation.phonemes import APART, PAUSE_SECONDS, Planner, without_stress

from .helpers import VOICE, needs_voice


class PlanTest(unittest.TestCase):
    planner = Planner("nl")

    def text(self, given: str, written: str | None = None) -> list[str]:
        return ["".join(s.phonemes) for s in self.planner.plan(given, written)]

    @needs_voice
    def test_plain_text_gets_the_phonemes_piper_would_use(self):
        piper = PiperVoice.load(VOICE)
        for text in [
            "Je kiest de of het met regels, en je maakt meervoud en verkleinwoord.",
            "Hoe laat is het? Het is half elf. Kom je ook?",
            "Aan het eind van groep 8 krijgt een kind een advies; dat is belangrijk: echt.",
        ]:
            # Piper sometimes leaves two spaces (before a number) or a space at the end; the plan never does
            expected = [" ".join("".join(s).split()) for s in piper.phonemize(text)]
            self.assertEqual(self.text(text), expected, text)

    def test_keeps_the_pause_after_a_block_and_the_space_before_the_next_word(self):
        # Piper 1.8 makes this "ɣə bə vərhət": no pauses, and "ver-" glued to "het"
        self.assertEqual(
            self.text("Woorden met [[ɣə]], [[bə]], [[vər]]: het gesprek."),
            ["ʋˈɔːrdən mˈɛt ɣə, bə, vər: hət ɣəsprˈɛk."],
        )

    def test_a_full_stop_after_a_block_ends_the_sentence(self):
        self.assertEqual(self.text("Meestal [[ən]]. Daarna [[ˈɛs]]!"), ["mˈeːstˌɑl ən.", "dˈaːrnaː ˈɛs!"])

    def test_says_a_block_with_pauses_apart_and_slower(self):
        [s] = self.planner.plan("Je kiest [[‖dˈə‖ˈɔf‖hˈɛt‖]] met regels.", "Je kiest de of het met regels.")
        said = "".join(s.phonemes)
        self.assertEqual(said, "jə kˈist, dˈə, ˈɔf, hˈɛt, mɛt rˈeːɣəls.")
        # a pause on each comma put in for it, none at the full stop
        self.assertEqual(sorted(s.pauses), [i for i, p in enumerate(s.phonemes) if p == ","])
        self.assertEqual(set(s.pauses.values()), {PAUSE_SECONDS})
        # each article its own word, said slower; the words around them at the line's own pace
        words = {w.text: w for w in s.words}
        self.assertEqual([w.text for w in s.words], ["Je", "kiest", "de", "of", "het", "met", "regels"])
        for name in ["de", "of", "het"]:
            self.assertEqual({s.slower.get(i) for i in range(words[name].start, words[name].end)}, {APART})
        self.assertNotIn(words["met"].start, s.slower)

    def test_a_pause_takes_the_sign_of_the_text_and_none_at_the_edges_of_a_sentence(self):
        [s] = self.planner.plan("[[‖ɣˈə‖]], [[‖vˈər‖]]: het gesprek", "ge-, ver-: het gesprek")
        # "ver-:" is one pause on the colon, not a comma and a colon; nothing before the first word part
        self.assertEqual("".join(s.phonemes), "ɣˈə, vˈər: hət ɣəsprˈɛk")
        self.assertEqual([s.phonemes[i] for i in sorted(s.pauses)], [",", ":"])
        # at the end of a line or sentence, the line's own silence follows: no pause, no comma put in
        self.assertEqual(self.text("Min [[‖ˈən‖]]", "Min -en"), ["mˈɪn, ˈən"])
        self.assertEqual(self.text("Meestal [[‖ˈən‖]]. Dan [[‖ˈɛs‖]]", "Meestal -en. Dan -s"), ["mˈeːstˌɑl, ˈən.", "dˈɑn, ˈɛs"])
        for sentence in self.planner.plan("Meestal [[‖ˈən‖]]. Dan [[‖ˈɛs‖]]", "Meestal -en. Dan -s"):
            self.assertEqual(len(sentence.pauses), 1)
            self.assertLess(max(sentence.pauses), len(sentence.phonemes) - 3)
        # nor on the text's own sign when the line ends there
        [s] = self.planner.plan("Achter [[‖ˈən‖]]:", "Achter -en:")
        self.assertEqual("".join(s.phonemes), "ˈɑxtər, ˈən:")
        self.assertEqual(list(s.pauses), [6])

    def test_names_each_word_and_the_word_a_block_stands_for(self):
        [s] = self.planner.plan("De [[ˈɛp]] is gratis.", "De app is gratis.")
        self.assertEqual([(w.text, w.source) for w in s.words], [("De", "espeak"), ("app", "lexicon"), ("is", "espeak"), ("gratis", "espeak")])
        for w in s.words:
            self.assertEqual("".join(s.phonemes[w.start : w.end]), w.phonemes)

    def test_a_number_said_as_two_words_belongs_to_the_number(self):
        [s] = self.planner.plan("Het is 10.30 uur.")
        self.assertEqual([w.text for w in s.words], ["Het", "is", "10.30", "uur"])

    def test_tells_when_espeak_switches_language(self):
        [s] = self.planner.plan("Kijk op de website.")
        self.assertEqual({w.text: w.language for w in s.words}["website"], "en")
        self.assertIsNone({w.text: w.language for w in s.words}["Kijk"])
        self.assertNotIn("(", "".join(s.phonemes))

    def test_without_stress(self):
        self.assertEqual(without_stress("ˈaːnsprˌaːk"), "aːnspraːk")


if __name__ == "__main__":
    unittest.main()
