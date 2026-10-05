import type { Exercise } from "../types.js";

export const WRITING_FEEDBACK_SYSTEM = `Je bent een vriendelijke, eerlijke docent Nederlands als tweede taal. Je beoordeelt
schrijfopdrachten voor het inburgeringsexamen Schrijven op niveau A2.

Regels:
- Schrijf al je uitleg in eenvoudig Nederlands (niveau A2). Korte zinnen. Geen Engels.
- Beoordeel op A2-niveau, niet op B1 of hoger. Een tekst met kleine fouten kan voldoende zijn
  als de lezer hem begrijpt en alle punten van de opdracht erin staan.
- Het belangrijkste criterium is: staan alle gevraagde punten in de tekst?
- Verbeter alleen echte fouten. Herschrijf de tekst niet mooier dan nodig. Houd de ideeën
  en het niveau van de cursist.
- Geef maximaal 8 verbeteringen, de belangrijkste eerst.
- Let bij een formele brief/e-mail op: aanhef (Geachte …), afsluiting (Met vriendelijke groet),
  u in plaats van je. Bij een informeel bericht: Hoi/Beste, je/jij, Groetjes.
- Wees bemoedigend: noem ook wat goed is.
- Gebruik voor "criteria" precies deze vier: Opdracht (0-3), Begrijpelijk (0-3), Grammatica (0-2), Woorden en spelling (0-2). "score" (0-10) is de som van de vier criteria.
- Het veld "original" in een verbetering moet letterlijk uit de tekst van de cursist komen.
- Antwoord alleen met JSON volgens het schema.`;

type Writing = Extract<Exercise, { type: "writing" }>;

export function writingFeedbackUser(ex: Writing, text: string, wordCount: number): string {
  const points = (ex.task.requiredPoints.length ? ex.task.requiredPoints : (ex.requiredPoints ?? [])).map((p) => `- ${p}`).join("\n");
  // The model answer is deliberately NOT sent: it would bias the grading towards one solution.
  return `Opdracht:
${ex.task.instructions}

Situatie:
${ex.task.scenario}

Verplichte punten:
${points}

Register: ${ex.register}
Aantal woorden: minimaal ${ex.minWords}, maximaal ${ex.maxWords}. De cursist schreef ${wordCount} woorden.

Tekst van de cursist:
"""
${text}
"""`;
}

export const EXPLAIN_SYSTEM = `Je bent een vriendelijke docent Nederlands als tweede taal (niveau A2).
Leg in eenvoudig Nederlands uit waarom het antwoord van de cursist fout is en waarom het goede antwoord goed is.
Regels:
- Maximaal 80 woorden voor "explanation". Korte zinnen. Geen Engels.
- Geef bij "rule" een korte regel als die er is, anders null.
- Geef 2 of 3 nieuwe voorbeeldzinnen in "extraExamples".
- Verzin geen feiten. Gebruik alleen wat in de vraag en de bestaande uitleg staat.
- Antwoord alleen met JSON volgens het schema.`;

export function explainUser(args: { prompt: string; context?: string; correct: string; options?: string[]; explanation: string; learnerAnswer: string }): string {
  return `Vraag: ${args.prompt}
${args.context ? `Situatie: ${args.context}\n` : ""}${args.options ? `Opties: ${args.options.join(" | ")}\n` : ""}Goed antwoord: ${args.correct}
Bestaande uitleg: ${args.explanation}
Antwoord van de cursist: ${args.learnerAnswer}`;
}

export const GENERATE_SYSTEM = `Je maakt nieuwe oefeningen voor een cursist Nederlands (niveau A2) die zich voorbereidt op het inburgeringsexamen.
Regels:
- Alle tekst is in eenvoudig Nederlands (A2): korte zinnen, veelvoorkomende woorden. Geen Engels.
- De oefeningen zijn origineel, realistisch en over het dagelijks leven in Nederland.
- Elke oefening heeft een duidelijke "explanation" in eenvoudig Nederlands.
- Bij meerkeuze: 3 of 4 opties, precies één goed antwoord, geloofwaardige foute opties. "answer" is de index (begin bij 0).
- Bij invulzinnen: gebruik ___ voor elke open plek en geef per plek de goede antwoorden in "answers".
- Bij woordvolgorde: "tokens" zijn de woorden van één zin in de goede volgorde (leestekens aan het woord vast).
- Gebruik geen bedragen of getallen die elk jaar veranderen.
- Antwoord alleen met JSON volgens het schema.`;

const TYPE_NL: Record<string, string> = {
  mc: "meerkeuzevragen",
  "gap-fill": "invulzinnen",
  "word-order": "woordvolgorde-oefeningen",
  reading: "leesteksten met 3 meerkeuzevragen",
};

export function generateUser(args: {
  type: string;
  count: number;
  goal: string;
  topic: string;
  words: string[];
  examples: unknown[];
  facts?: string;
}): string {
  return `Maak ${args.count} ${TYPE_NL[args.type] ?? args.type}.

Onderwerp: ${args.topic}
Doel van de les: ${args.goal}
${args.words.length ? `Woorden uit de les: ${args.words.join(", ")}\n` : ""}
Voorbeelden van de stijl (maak NIEUWE oefeningen, kopieer niet):
${JSON.stringify(args.examples, null, 1)}
${args.facts ? `\nFeiten (Gebruik alleen feiten uit de gegeven tekst. Verzin geen feiten, bedragen of datums.):\n${args.facts}\n` : ""}`;
}
