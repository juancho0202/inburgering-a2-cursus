import { describe, expect, it } from "vitest";
import { exerciseAnnouncement, stepAnnouncement, stepSegments } from "../../src/lib/announce";
import { lessonTune, playCorrect, playLessonMelody } from "../../src/lib/sound";
import { dutchNumber, dutchOrdinal, speakable, voiceInput, voiceKey } from "../../src/lib/announce";
import { PRONUNCIATIONS } from "../../shared/content/pronunciations";

const base = { id: "x", tags: [], explanation: "", difficulty: 1 as const };

describe("voice announcements", () => {
  it("reads the sentence of gap and true/false exercises, not just the instruction", () => {
    expect(exerciseAnnouncement({ ...base, type: "gap-fill", prompt: "Maak de vergrotende trap (groot).", text: "Mijn broer is ___ dan ik.", answers: [["groter"]] }))
      .toBe("Maak de vergrotende trap (groot). Mijn broer is ___ dan ik.");
    expect(exerciseAnnouncement({ ...base, type: "true-false", prompt: "Klopt dit?", statement: "Half acht is 8.30.", answer: false }))
      .toBe("Klopt dit? Half acht is 8.30.");
  });

  it("reads only the question of a gap with a choice list", () => {
    const e = { ...base, type: "gap-choice" as const, prompt: "Kies de goede vorm.", text: "___ jij vandaag werken?", options: [["Moet", "Moeten"]], answers: [0] };
    expect(exerciseAnnouncement(e)).toBe("Kies de goede vorm.");
    expect(exerciseAnnouncement(e, false)).toBe("");
  });

  it("names the lesson on the first step only", () => {
    const step = { type: "lesson" as const, id: "l", title: "De of het?", blocks: [] };
    expect(stepAnnouncement(step, { first: true, unitTitle: "De of het", lessonNumber: 11 })).toBe("Les 11. De of het. De of het?");
    expect(stepAnnouncement(step, { first: false, unitTitle: "De of het", lessonNumber: 11 })).toBe("De of het?");
    expect(stepAnnouncement({ ...step, title: "De of het" }, { first: true, unitTitle: "De of het", lessonNumber: 11 })).toBe("Les 11. De of het.");
  });

  it("reads the goal and the readable blocks of a lesson step, in order", () => {
    const step = {
      type: "lesson" as const,
      id: "l",
      title: "Hoe laat is het?",
      blocks: [
        { kind: "text" as const, md: "Je zegt **half acht**." },
        { kind: "table" as const, headers: ["a"], rows: [["b"]] },
        { kind: "tip" as const, md: "Oefen hardop." },
      ],
    };
    const segs = stepSegments(step, { first: false, unitTitle: "Tijd", goal: "Je leert de tijd." });
    expect(segs.map((s) => s.id)).toEqual(["heading", "goal", "block-0", "block-2"]);
    expect(segs[3].text).toBe("Tip: Oefen hardop.");
  });

  it("plays a listening task after its question, as a line of its own", () => {
    const exercise = { id: "q", tags: [], explanation: "e", difficulty: 1 as const, type: "mc" as const, prompt: "Luister. Welk getal hoor je?", listen: "veertien", options: ["14", "40"], answer: 0 };
    const segs = stepSegments({ type: "exercise", exercise }, { first: false, unitTitle: "Tijd" });
    expect(segs).toEqual([
      { id: "heading", text: "Luister. Welk getal hoor je?" },
      { id: "listen", text: "veertien" },
    ]);
  });

  it("doesn't repeat the instruction of the exercise before, but still reads the sentence", () => {
    const order = { ...base, type: "mc" as const, prompt: "Zet de woorden in de goede volgorde.", options: ["a", "b"], answer: 0 };
    expect(stepSegments({ type: "exercise", exercise: order }, { first: false, unitTitle: "Tijd", previousPrompt: order.prompt })).toEqual([]);
    expect(stepSegments({ type: "exercise", exercise: order }, { first: false, unitTitle: "Tijd", previousPrompt: "Kies." })[0].text).toBe(order.prompt);
    const gap = { ...base, type: "gap-fill" as const, prompt: "Vul in.", text: "Ik ___ thuis.", answers: [["ben"]] };
    expect(stepAnnouncement({ type: "exercise", exercise: gap }, { first: false, unitTitle: "Tijd", previousPrompt: "Vul in." })).toBe("Ik ___ thuis.");
  });

  it("gives list items and lines their own pause", () => {
    expect(speakable("Je ziet:\n- de bus\n- de trein")).toBe("Je ziet: de bus. de trein");
  });

  it("never reads a markdown table, only the text around it", () => {
    const md = "**Verbindingswoorden** maken je tekst beter:\n\n| Woord | Gebruik |\n| --- | --- |\n| en | twee dingen samen |\n\nGebruik ze vaak.";
    expect(speakable(md)).toBe("Verbindingswoorden maken je tekst beter: Gebruik ze vaak.");
    expect(speakable("| a | b |\n| --- | --- |\n| c | d |")).toBe("");
  });

  it("skips rules, code fences and images, and never says a stray pipe", () => {
    expect(speakable("Eerst.\n\n---\n\nDaarna.")).toBe("Eerst. Daarna.");
    expect(speakable("Kijk ![de kaart](kaart.png) goed.")).toBe("Kijk goed.");
    expect(speakable("een | twee")).toBe("een twee");
    expect(speakable("___")).toBe("…");
  });

  it("leaves a lesson block that is only a table out of the read-along", () => {
    const step = {
      type: "lesson" as const,
      id: "l",
      title: "Tijd",
      blocks: [{ kind: "text" as const, md: "| a | b |\n| --- | --- |\n| c | d |" }, { kind: "tip" as const, md: "Oefen." }],
    };
    expect(stepSegments(step, { first: false, unitTitle: "Tijd" }).map((s) => s.id)).toEqual(["heading", "block-1"]);
  });

  it("turns gaps and markdown into speakable text", () => {
    expect(speakable("Vaak **het**: *het gesprek*, ___ blikje")).toBe("Vaak het: het gesprek, … blikje");
  });
});

describe("lesson tunes", () => {
  it("are the same every time for a lesson number and differ between numbers", () => {
    expect(lessonTune(3)).toEqual(lessonTune(3));
    const tunes = new Set(Array.from({ length: 16 }, (_, i) => JSON.stringify(lessonTune(i + 1))));
    expect(tunes.size).toBe(16);
  });

  it("fit in two bars and play the melody in order", () => {
    for (let n = 1; n <= 16; n++) {
      const pos = lessonTune(n).melody.map(([p]) => p);
      expect(pos.every((p, i) => p >= 0 && p < 16 && (i === 0 || p > pos[i - 1]))).toBe(true);
    }
  });

  it("do nothing without Web Audio", () => {
    expect(() => playCorrect()).not.toThrow();
    expect(playLessonMelody(1, 0)).toBe(0);
  });

  it("spells abbreviations letter by letter, but leaves words that are said as a word", () => {
    expect(speakable("**vmbo** (4 jaar), havo (5 jaar), vwo (6 jaar)")).toBe("vee em bee oo, 4 jaar, havo, 5 jaar, vee wee oo, 6 jaar");
    expect(speakable("Hij doet een mbo-opleiding. Na de HBO: wo.")).toBe("Hij doet een em bee oo opleiding. Na de haa bee oo: wee oo.");
    expect(speakable("Het UWV, de GGD en je BSN. Bel DUO via DigiD.")).toBe("Het uu wee vee, de gee gee dee en je bee es en. Bel DUO via DigiD.");
    expect(speakable("Een bedrijf bij de KVK, hulp van het CJG, je diploma bij IDW.")).toBe("Een bedrijf bij de kaa vee kaa, hulp van het see jee gee, je diploma bij ie dee wee.");
  });

  it("says signs as the words a teacher uses, not by their name", () => {
    expect(speakable("De stam is de infinitief min -en: werken → werk.")).toBe("De stam is de infinitief min -en: werken, werk.");
    expect(speakable("Perfectum = hebben/zijn + voltooid deelwoord.")).toBe("Perfectum is hebben of zijn plus voltooid deelwoord.");
    expect(speakable("Huisarts / huisartsenpost. A ≠ B. 5% korting & gratis.")).toBe("Huisarts of huisartsenpost. A is niet B. 5 procent korting en gratis.");
    // a slash between numbers is not "of"
    expect(speakable("1/2")).toBe("1/2");
  });

  it("pauses at brackets, dots and dashes, which the voice would run through", () => {
    expect(speakable("meestal -en (dozen, boeken). Daarna")).toBe("meestal -en, dozen, boeken. Daarna");
    expect(speakable("de grote jas · een grote jas · het grote huis")).toBe("de grote jas. een grote jas. het grote huis");
    expect(speakable("Kun je … ? · Ik kan niet")).toBe("Kun je …? Ik kan niet");
    expect(speakable("Hij komt – zegt hij – morgen.")).toBe("Hij komt, zegt hij, morgen.");
    expect(speakable("(Dat klopt.) Goed zo.")).toBe("Dat klopt. Goed zo.");
    expect(speakable("Ik schrijf u, … ik ziek ben.")).toBe("Ik schrijf u, … ik ziek ben.");
  });

  it("reads ranges, amounts and ordinals as words", () => {
    expect(speakable("'s ochtends (6–12), 's middags (12–18)")).toBe("'s ochtends, 6 tot 12, 's middags, 12 tot 18");
    expect(speakable("Nederland was bezet (1940–1945).")).toBe("Nederland was bezet, 1940 tot 1945.");
    expect(speakable("€ 12,50 · €3 · € 5,- · € 0,75 · € 2,00")).toBe("12 euro 50. 3 euro. 5 euro. 75 cent. 2 euro");
    expect(speakable("Spanje (16e en 17e eeuw), de 21ste eeuw, de 2de keer")).toBe("Spanje, zestiende en zeventiende eeuw, de eenentwintigste eeuw, de tweede keer");
  });

  it("says numbered points as points, but keeps a bracket that closes", () => {
    expect(speakable("Uitleg: 1) aanhef; 2) wat en wanneer (zaterdag); 3) einde")).toBe("Uitleg: 1: aanhef; 2: wat en wanneer, zaterdag; 3: einde");
    expect(speakable("tussen (12–18) uur")).toBe("tussen, 12 tot 18, uur");
  });

  it("leaves out pictures and strike-through marks", () => {
    expect(speakable("Open het menu met de knop ☰. Goed zo 👍!")).toBe("Open het menu met de knop. Goed zo!");
    expect(speakable("Fout: ~~Denk ik dat we gaan.~~")).toBe("Fout: Denk ik dat we gaan.");
  });

  it("writes numbers and ordinals in Dutch", () => {
    expect([0, 7, 13, 20, 21, 22, 23, 48, 100, 116, 300, 1000, 1945, 2013].map(dutchNumber)).toEqual([
      "nul", "zeven", "dertien", "twintig", "eenentwintig", "tweeëntwintig", "drieëntwintig", "achtenveertig", "honderd",
      "honderdzestien", "driehonderd", "duizend", "duizend negenhonderdvijfenveertig", "tweeduizend dertien",
    ]);
    expect([1, 2, 3, 4, 8, 12, 16, 20, 21, 100, 101, 108, 1000].map(dutchOrdinal)).toEqual([
      "eerste", "tweede", "derde", "vierde", "achtste", "twaalfde", "zestiende", "twintigste", "eenentwintigste",
      "honderdste", "honderdeerste", "honderdachtste", "duizendste",
    ]);
  });
});

describe("what the recorded voice is given", () => {
  it("says word parts and listed words with their pronunciation, the longest match first", () => {
    expect(voiceInput("woorden met **ge-, be-, ver-**: het gesprek")).toBe(
      `woorden met [[${PRONUNCIATIONS["ge-"]}]], [[${PRONUNCIATIONS["be-"]}]], [[${PRONUNCIATIONS["ver-"]}]]: het gesprek`,
    );
    expect(voiceInput("-je, -tje, -etje")).toBe(`[[${PRONUNCIATIONS["-je"]}]], [[${PRONUNCIATIONS["-tje"]}]], [[${PRONUNCIATIONS["-etje"]}]]`);
    expect(voiceInput("Meneer gebruikt de App.")).toBe(`[[${PRONUNCIATIONS.meneer}]] gebruikt de [[${PRONUNCIATIONS.app}]].`);
  });

  it("says the articles apart when the lesson talks about them, not when they are used", () => {
    expect(voiceInput("De of het?")).toBe("[[‖dˈə‖ˈɔf‖hˈɛt‖]]?");
    expect(voiceInput("Je kiest **de of het** met regels.")).toBe("Je kiest [[‖dˈə‖ˈɔf‖hˈɛt‖]] met regels.");
    expect(voiceInput("Bij het-woorden: ons huis.")).toBe(`Bij [[${PRONUNCIATIONS["het-woorden"]}]]: ons huis.`);
    for (const t of ["De man of het kind.", "Is het de bus of het huis?"]) expect(voiceInput(t)).toBe(speakable(t));
  });

  it("does not touch the same letters inside a word", () => {
    for (const t of ["vijf-en-twintig", "Groente- en fruitresten", "een appel en apps", "de gemeente", "beter"]) expect(voiceInput(t)).toBe(speakable(t));
  });

  it("keeps the clip name of a line without listed words, and changes it when a pronunciation it uses changes", () => {
    // recorded before pronunciations existed: these clips must not be recorded again
    expect(voiceKey("De knoppen", "ronnie")).toBe("d7a9064c");
    const before = voiceKey("Hij gebruikt de app.", "alex");
    const app = PRONUNCIATIONS.app;
    try {
      PRONUNCIATIONS.app = "ˈɑp";
      expect(voiceKey("Hij gebruikt de app.", "alex")).not.toBe(before);
      expect(voiceKey("De knoppen", "ronnie")).toBe("d7a9064c");
    } finally {
      PRONUNCIATIONS.app = app;
    }
  });
});

describe("abbreviations", () => {
  it("does not spell ordinary words that look like an abbreviation", () => {
    expect(speakable("Of or woord wolk ovaal tvx")).toBe("Of or woord wolk ovaal tvx");
    expect(speakable("De OR praat namens de werknemers.")).toBe("De oo er praat namens de werknemers.");
  });
});
