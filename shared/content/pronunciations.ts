/**
 * How the recorded voice says words that its phonemiser (espeak-ng, inside Piper) gets wrong, written in the phonemes
 * the Piper voices were trained on. scripts/tts finds these words (see "Checking the pronunciation" in
 * scripts/tts/README.md); add the word here, run `npm run voice`, and the lines that use it are recorded again
 * (a line's clip name includes the pronunciations it uses, see voiceInput in src/lib/announce.ts).
 *
 * Keys are whole words, matched in any case, or word parts with their hyphen ("-tje", "ge-") as the grammar lessons
 * write them. Values use only DUTCH_PHONEMES: the stress marks ˈ (main) and ˌ (secondary) go before the stressed
 * vowel's syllable, ː makes a vowel long. Write them the way espeak writes Dutch (ɵ for the u in "bus", ʌʊ for ou,
 * ɛɪ for ei/ij, œy for ui, ɪː for ee before r, tʲ for tj), not as a dictionary does: the voices only know espeak's.
 */
export const PRONUNCIATIONS: Record<string, string> = {
  // Word parts in the grammar lessons. Said like they sound in a word ("-tje" as in "huisje"), except a single
  // letter, which is said by its name ("-t" is "tee"), as a teacher does. espeak reads many of them as letters
  // ("be-" became "bee-ee") or stresses a vowel that is a schwa in the word ("-tje" became "tee").
  "ge-": "ɣə",
  "be-": "bə",
  "ver-": "vər",
  "aan-": "ˈaːn",
  "af-": "ˈɑf",
  "in-": "ˈɪn",
  "mee-": "mˈeː",
  "op-": "ˈɔp",
  "over-": "ˈoːvər",
  "-af": "ˈɑf",
  "-door": "dˈoːr",
  "-e": "ˈeː",
  "-el": "əl",
  "-en": "ən",
  "-er": "ər",
  "-st": "ˈɛs tˈeː",
  "-s": "ˈɛs",
  "-t": "tˈeː",
  "-d": "dˈeː",
  "-je": "jə",
  "-tje": "tʲə",
  "-pje": "pjə",
  "-etje": "ətʲə",
  "-ing": "ɪŋ",
  "-heid": "hɛɪt",
  "-tie": "tsi",
  "-ment": "mˈɛnt",
  "-isme": "ˈɪsmə",
  "-tien": "tˈin",
  "-tig": "təx",

  // Words. espeak stresses or reads these wrong; the Dutch is from a dictionary (WikiPron), written as espeak would.
  aansprakelijkheidsverzekering: "ˈaːnsprˌaːkələkhɛɪtsfərzˌeːkərɪŋ",
  apotheek: "ˌaːpoːtˈeːk",
  apotheker: "ˌaːpoːtˈeːkər",
  app: "ˈɛp",
  appen: "ˈɛpən",
  arbeidsongeschiktheidsverzekering: "ˈɑrbɛɪtsɔnɣəsxˌɪkthɛɪtsfərzˌeːkərɪŋ",
  balletje: "bˈɑlətʲə",
  basisverzekering: "bˈaːzɪsfərzˌeːkərɪŋ",
  bibliotheek: "bˌiblijoːtˈeːk",
  bibliotheekpas: "bˌiblijoːtˈeːkpˌɑs",
  container: "kɔntˈeːnər",
  fysiotherapeut: "fˌizijoːtˌeːraːpˈœyt",
  fysiotherapie: "fˌizijoːtˌeːraːpˈi",
  geografie: "ɣˌeːjoːɣraːfˈi",
  inburgeren: "ˈɪnbɵrɣərən",
  plastic: "plˈɛstɪk",
  privacy: "prˈɑjvəsi",
  slavenhandel: "slˈaːvənhˌɑndəl",
  verzekeringspas: "vərzˈeːkərɪŋspˌɑs",
  website: "ʋˈɛpsɑjt",
  weekend: "ʋˈikɛnt",
  zorgverzekering: "zˈɔrxfərzˌeːkərɪŋ",

  // A stressed "eer" at the end of a word or before -t/-d. espeak makes its vowel short ("wanneer" as "wannir"; the
  // check calls this short-eer); ɪː is espeak's own long ee before r, as in "meer".
  brandweer: "brˈɑntʋˌɪːr",
  controleer: "kˌɔntroːlˈɪːr",
  controleert: "kˌɔntroːlˈɪːrt",
  feliciteert: "fˌeːlisitˈɪːrt",
  gedeputeerde: "ɣədˌeːpytˈɪːrdə",
  gediscrimineerd: "ɣədˌɪskriminˈɪːrt",
  gefeliciteerd: "ɣəfˌeːlisitˈɪːrt",
  gereserveerd: "ɣərˌeːzərvˈɪːrt",
  ijsselmeer: "ˈɛɪsəlmˌɪːr",
  meneer: "mənˈɪːr",
  organiseert: "ˌɔrɣaːnizˈɪːrt",
  probeer: "proːbˈɪːr",
  reageert: "rˌeːaːɣˈɪːrt",
  repareer: "rˌeːpaːrˈɪːr",
  repareert: "rˌeːpaːrˈɪːrt",
  solliciteert: "sˌɔlisitˈɪːrt",
  waardeert: "ʋaːrdˈɪːrt",
  wanneer: "ʋɑnˈɪːr",
};

/**
 * Words the check in scripts/tts asks about, but espeak says right: the dictionary gives another variant, the
 * difference is only in how it is written, or the letters are meant. Listening to the clip decided; the check stops
 * asking about them.
 */
export const ESPEAK_IS_RIGHT: string[] = [
  // "'t kofschip: … op t, k, f, s, ch, p": the letters, said by their names
  "ch",
];

/**
 * Words the listener in scripts/tts does not hear as planned in one voice, on every take, although they sound right
 * (the listener's blind spot, not the voice's fault), by voice id (see VOICES). The sound check stops reporting them
 * for that voice. Listening decided, as for ESPEAK_IS_RIGHT.
 */
export const HEARD_RIGHT: Record<string, string[]> = {};

/** The phonemes espeak uses for Dutch, which are the ones the Piper voices know (the space separates words). */
export const DUTCH_PHONEMES = "abdefhijklmnoprstuvwxyzøŋœɑɔəɛɡɣɪɲɵɾʃʊʋʌʒʲˈˌː ";
