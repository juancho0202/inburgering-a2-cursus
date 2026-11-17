import unittest

from piper import PiperVoice

from pronunciation.phonemes import Planner, without_stress

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
