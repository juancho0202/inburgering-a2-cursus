import type { WritingFeedback } from "../schemas/claude.js";
import { buildSegments } from "./corrections.js";

/**
 * Word missions for the taalcafé topics: per topic a few levels, each a fixed set of words to use in the chat.
 * The lists are static (no Claude call decides what counts): a word counts when the learner writes one of its
 * forms correctly, i.e. outside a chunk that was corrected. Levels go from first words to richer ones.
 * Course content: Dutch only.
 */
export interface TopicWord {
  /** What the learner sees. */
  word: string;
  /** Every spelling that counts, lower case; may be a few words ("op vakantie"). The word itself is one of them. */
  forms: string[];
}
export interface TopicLevel {
  /** Sanne's first line for this level: each level is a new conversation, so it starts somewhere else. */
  opener: string;
  words: TopicWord[];
}

/** Words on screen at the same time; a used word makes room for the next one of the level. */
export const WORDS_SHOWN = 3;

// "wonen|woon|woont|woonde" → shown as "wonen", any of the four counts.
const level = (opener: string, words: string[]): TopicLevel => ({
  opener,
  words: words.map((w) => {
    const forms = w.split("|").map((f) => f.trim().toLowerCase());
    return { word: w.split("|")[0], forms };
  }),
});

export const TOPIC_LEVELS: Record<string, TopicLevel[]> = {
  kennismaken: [
    level("Hoi! Ik ben Sanne. Welkom in het taalcafé. Hoe heet jij, en waar kom je vandaan?", [
      "heten|heet|heette",
      "wonen|woon|woont|woonde|woonden|gewoond",
      "komen|kom|komt|kwam|kwamen|gekomen",
      "jaar|jaren",
      "land|landen",
      "taal|talen",
    ]),
    level("Hoi, leuk je weer te zien! Hoe lang woon je al in Nederland?", [
      "sinds",
      "spreken|spreek|spreekt|sprak|spraken|gesproken",
      "geboren",
      "getrouwd",
      "kinderen|kind",
      "Nederlands",
    ]),
    level("Hoi! Ik vraag me iets af: wat was het moeilijkst toen je net in Nederland woonde?", [
      "verhuizen|verhuis|verhuist|verhuisde|verhuisden|verhuisd",
      "vroeger",
      "wennen|wen|went|wende|wenden|gewend",
      "missen|mis|mist|miste|misten|gemist",
      "toekomst",
      "omdat",
    ]),
  ],
  weer: [
    level("Hoi! Wat een weer vandaag, hè? Hoe vind jij het weer in Nederland?", [
      "zon|zonnig",
      "regen|regenen|regent|regende|regenden|geregend",
      "koud|kouder|koude",
      "warm|warmer|warme",
      "wind",
      "graden|graad",
    ]),
    level("Hoi! Ik ben vandaag nat geworden op de fiets. Wat doe jij als het slecht weer is?", [
      "bewolkt",
      "paraplu|paraplu's",
      "jas|jassen",
      "sneeuw|sneeuwen|sneeuwt|sneeuwde|gesneeuwd",
      "seizoen|seizoenen",
      "herfst",
    ]),
    level("Hoi! Het weer in Nederland verandert zo snel. Kijk jij elke dag naar het weerbericht?", [
      "weerbericht",
      "voorspellen|voorspel|voorspelt|voorspelde|voorspelden|voorspeld",
      "onweer",
      "glad",
      "vochtig",
      "meestal",
    ]),
  ],
  weekend: [
    level("Hoi! Fijn dat je er bent. Wat heb je afgelopen weekend gedaan?", [
      "zaterdag",
      "zondag",
      "slapen|slaap|slaapt|sliep|sliepen|geslapen",
      "vrienden|vriend|vriendin|vriendinnen",
      "film|films",
      "markt",
    ]),
    level("Hoi! Ik ben zaterdag naar het strand gefietst. Hoe ziet een fijn weekend er voor jou uit?", [
      "boodschappen",
      "bezoeken|bezoek|bezoekt|bezocht|bezochten",
      "wandelen|wandel|wandelt|wandelde|wandelden|gewandeld",
      "fietsen|fiets|fietst|fietste|fietsten|gefietst",
      "ontbijt|ontbijten",
      "gezellig",
    ]),
    level("Hoi! Ik maak altijd plannen voor het weekend, maar dan gaat het toch anders. Heb jij al plannen?", [
      "plannen|plan",
      "afspraak|afspraken",
      "rustig|rustige",
      "druk|drukke",
      "museum|musea|museums",
      "volgende|volgend",
    ]),
  ],
  werk: [
    level("Hoi! Ik werk zelf in een bibliotheek. Werk jij, of volg je een opleiding?", [
      "werken|werk|werkt|werkte|werkten|gewerkt",
      "school|scholen",
      "baan|banen",
      "collega|collega's",
      "les|lessen",
      "uur|uren",
    ]),
    level("Hoi! Ik had vandaag een drukke dag op mijn werk. Hoe ziet jouw week eruit?", [
      "kantoor",
      "cursus|cursussen",
      "baas",
      "beroep|beroepen",
      "salaris",
      "vrij|vrije",
    ]),
    level("Hoi! Mijn neef zoekt een nieuwe baan. Wat voor werk zou jij later willen doen?", [
      "ervaring|ervaringen",
      "solliciteren|solliciteer|solliciteert|solliciteerde|solliciteerden|gesolliciteerd",
      "diploma|diploma's",
      "stage|stages",
      "contract|contracten",
      "vrijwilliger|vrijwilligers|vrijwilligerswerk",
    ]),
  ],
  familie: [
    level("Hoi! Ik heb twee kinderen, van 6 en 9 jaar. Heb jij familie in Nederland?", [
      "moeder",
      "vader",
      "ouders",
      "broer|broers",
      "zus|zussen",
      "kinderen|kind",
    ]),
    level("Hoi! Mijn oma is gisteren 90 geworden. Wat een feest! Zie jij je familie vaak?", [
      "oma|opa|oma's|opa's",
      "neef|neven|nicht|nichten",
      "jarig",
      "bellen|bel|belt|belde|belden|gebeld",
      "samen",
      "getrouwd",
    ]),
    level("Hoi! Mijn dochter lijkt echt op mijn moeder. Op wie lijk jij in je familie?", [
      "lijken|lijk|lijkt|leek|leken|geleken",
      "zorgen|zorg|zorgt|zorgde|zorgden|gezorgd",
      "schoonmoeder|schoonvader|schoonouders",
      "traditie|tradities",
      "ruzie",
      "trots",
    ]),
  ],
  eten: [
    level("Hoi! Ik heb vandaag soep gemaakt. Wat eet jij graag?", [
      "brood",
      "rijst",
      "groente|groenten|groentes",
      "koken|kook|kookt|kookte|kookten|gekookt",
      "lekker|lekkere",
      "honger",
    ]),
    level("Hoi! Ik wil iets nieuws koken deze week. Wat eet jij meestal 's avonds?", [
      "avondeten",
      "recept|recepten",
      "kruiden|kruid",
      "supermarkt",
      "proeven|proef|proeft|proefde|proefden|geproefd",
      "vegetarisch|vegetarische",
    ]),
    level("Hoi! Ik heb gehoord dat jij goed kunt koken. Wat is een typisch gerecht uit jouw land?", [
      "gerecht|gerechten",
      "bakken|bak|bakt|bakte|bakten|gebakken",
      "pittig|pittige",
      "ingrediënten|ingrediënt|ingredienten|ingredient",
      "gezond|gezonde|gezonder",
      "traditioneel|traditionele",
    ]),
  ],
  "vrije-tijd": [
    level("Hoi! Ik fiets graag, en ik zing in een koor. Wat doe jij graag in je vrije tijd?", [
      "sporten|sport|sportte|sportten|gesport",
      "voetbal|voetballen|voetbalt|voetbalde|gevoetbald",
      "muziek",
      "lezen|lees|leest|las|lazen|gelezen",
      "zwemmen|zwem|zwemt|zwom|zwommen|gezwommen",
      "hobby|hobby's",
    ]),
    level("Hoi! Ik was gisteren bij een concert in de stad. Wat doe jij 's avonds graag?", [
      "concert|concerten",
      "sportschool",
      "club|clubs|vereniging",
      "spelletje|spelletjes",
      "tuin",
      "serie|series",
    ]),
    level("Hoi! Ik wil iets nieuws leren in mijn vrije tijd. Wat zou jij nog willen leren?", [
      "lid",
      "trainen|train|traint|trainde|trainden|getraind",
      "ontspannen",
      "creatief|creatieve",
      "instrument|instrumenten",
      "vrijwilligerswerk",
    ]),
  ],
  buurt: [
    level("Hoi! Ik woon hier vlakbij. In welke buurt woon jij? Vind je het er leuk?", [
      "huis|huizen",
      "straat|straten",
      "buren|buurman|buurvrouw",
      "winkel|winkels",
      "park|parken",
      "appartement|appartementen",
    ]),
    level("Hoi! Bij mij in de straat is een nieuwe bakker gekomen. Wat is er allemaal in jouw wijk?", [
      "wijk|wijken",
      "bushalte",
      "verdieping",
      "huur",
      "verhuurder",
      "rustig|rustige",
    ]),
    level("Hoi! In mijn buurt praten ze veel over het nieuwe plan van de gemeente. Wat zou jij veranderen in jouw buurt?", [
      "gemeente",
      "veilig|veilige|veiliger",
      "overlast",
      "afval",
      "parkeren|parkeer|parkeert|parkeerde|parkeerden|geparkeerd",
      "contact",
    ]),
  ],
  vakantie: [
    level("Hoi! Binnenkort is het vakantie. Ga jij ergens naartoe, of blijf je thuis?", [
      "vakantie|vakanties",
      "reizen|reis|reist|reisde|reisden|gereisd",
      "zee",
      "strand",
      "vliegtuig",
      "hotel|hotels",
    ]),
    level("Hoi! Volgende week is het weer een feestdag. Welke feestdagen ken jij in Nederland?", [
      "feestdag|feestdagen",
      "Koningsdag",
      "Sinterklaas",
      "kerst|kerstmis|kerstfeest",
      "koffer|koffers",
      "camping",
    ]),
    level("Hoi! Welke feesten vieren jullie thuis? Ik ben benieuwd hoe dat bij jou gaat.", [
      "vieren|viert|vierde|vierden|gevierd",
      "cadeau|cadeaus|cadeautje|cadeautjes",
      "reserveren|reserveer|reserveert|reserveerde|reserveerden|gereserveerd",
      "gewoonte|gewoontes|gewoonten",
      "bezienswaardigheden|bezienswaardigheid",
      "heimwee",
    ]),
  ],
};

export const topicLevels = (topicId: string): TopicLevel[] => TOPIC_LEVELS[topicId] ?? [];

// Words in lower case, apostrophes kept inside a word (paraplu's), nothing else.
const tokens = (text: string) =>
  (text.normalize("NFC").toLowerCase().replace(/’/g, "'").match(/[\p{L}\p{N}']+/gu) ?? []).map((t) => t.replace(/^'+|'+$/g, "")).filter(Boolean);

/**
 * The words the learner used correctly in this message: one of the forms appears in a part of the text that was
 * not corrected. A struck-through chunk does not count, so a word only counts when it is written right.
 */
export function wordsUsed(text: string, corrections: WritingFeedback["corrections"], words: TopicWord[]): TopicWord[] {
  // Each uncorrected stretch on its own: a phrase must not be glued together across a correction.
  const parts = buildSegments(text, corrections).flatMap((s) => (s.kind === "text" ? [tokens(s.text)] : []));
  const has = (form: string) => {
    const want = tokens(form);
    return want.length > 0 && parts.some((p) => p.some((_, i) => want.every((w, j) => p[i + j] === w)));
  };
  return words.filter((w) => w.forms.some(has));
}
