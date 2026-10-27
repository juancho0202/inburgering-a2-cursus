import type { InjectionKey } from "vue";
import type { Exercise, Unit } from "@shared/types";
import sceneAlts from "../assets/scenes/index.json";
import spotAlts from "../assets/spots/index.json";

// The drawings come from scripts/illustrations (npm run illustrations). Only the URLs are bundled:
// the browser downloads a picture the first time it is shown.
const urls = (found: Record<string, string>) => Object.fromEntries(Object.entries(found).map(([file, url]) => [file.replace(/^.*\/|\.svg$/g, ""), url]));
const sceneUrls = urls(import.meta.glob<string>("../assets/scenes/*.svg", { eager: true, query: "?url", import: "default" }));
const spotUrls = urls(import.meta.glob<string>("../assets/spots/*.svg", { eager: true, query: "?url", import: "default" }));

export interface Picture {
  url: string;
  alt: string;
}

export type SpotPicture = Picture & { side: "left" | "right" };

/** The drawing for the question on screen (provided by the exercise shell, shown by the question). */
export const spotKey: InjectionKey<SpotPicture | null> = Symbol("spot");

export function scene(id: string | undefined): Picture | null {
  if (!id || !sceneUrls[id]) return null;
  return { url: sceneUrls[id], alt: (sceneAlts as Record<string, string>)[id] ?? "" };
}

export function spot(id: string | undefined): Picture | null {
  if (!id || !spotUrls[id]) return null;
  return { url: spotUrls[id], alt: (spotAlts as Record<string, string>)[id] ?? "" };
}

/**
 * Things a question can be about, and their drawing; the first match wins, so the more telling things come first.
 * The prompt is searched before the rest of the question (context, sentence, statement, situation), and the answer
 * options are never searched, so a drawing never points at one of them. Days and dates count only in the prompt:
 * in a grammar sentence ("Ik moet morgen werken") they are not what the question is about.
 */
const ABOUT: { re: RegExp; spot: string; promptOnly?: boolean }[] = [
  { re: /\b(e-?mail\w*|mailen|computer|laptop|internet|website|webwinkel|online|digid)\b/, spot: "computer" },
  { re: /\b(brief|brieven|briefje|envelop|post)\b/, spot: "brief" },
  { re: /\b(formulier\w*)\b/, spot: "lezen" },
  { re: /\b(bel|belt|bellen|gebeld|telefoon|telefoneren|bericht|sms|appje)\b/, spot: "telefoon" },
  { re: /\b(medicijn\w*|apotheek|apotheker|recept|pillen|paracetamol)\b/, spot: "medicijnen" },
  { re: /\b(huisarts|dokter|arts|ziekenhuis|ziek|tandarts|verpleegkundige)\b/, spot: "dokter" },
  { re: /\b(afval|grofvuil|gft|glasbak|container|vuilnis\w*|weggooien|gooi|gooit|bak|groente|fruitresten|flesje)\b/, spot: "afval" },
  { re: /\bverhui[sz]\w*/, spot: "verhuisdoos" },
  { re: /\bsleutel/, spot: "sleutels" },
  { re: /\b(stem|stemt|stemmen|verkiezing\w*|stembureau|stembus|stempas)\b/, spot: "stembus" },
  { re: /\b(fiets|fietst|fietsen|fietser)\b/, spot: "fietser" },
  { re: /\b(hond|honden)\b/, spot: "hond" },
  { re: /\b(kat|katten|poes)\b/, spot: "kat" },
  { re: /\b(koe|koeien|boer|boerderij)\b/, spot: "koe" },
  { re: /\b(eend|eenden)\b/, spot: "eend" },
  { re: /\b(tulp|tulpen)\b/, spot: "tulpen" },
  { re: /\b(molen|molens)\b/, spot: "molen" },
  { re: /\b(bloem|bloemen)\b/, spot: "bloemen" },
  { re: /\b(koffie|thee|bezoek\w*|visite)\b/, spot: "koffie" },
  { re: /\b(oma|opa|grootouders?)\b/, spot: "oma" },
  { re: /\b(rolstoel|handicap|beperking)\b/, spot: "rolstoel" },
  { re: /\b(diploma|opleiding|mbo|hbo|universiteit|studie|studeren|student)\b/, spot: "diploma" },
  { re: /\b(boek|boeken|bibliotheek|krant)\b/, spot: "boek" },
  { re: /\b(huis|woning|huurhuis|huurwoning|huur|huren|huurt|huurder|verhuurder|huisbaas|flat)\b/, spot: "huis" },
  { re: /€|\beuro|\bgeld\b|\bbetaal|\bbetalen|\bprijs|\bkost\b|\bkosten\b|\bloon\b|\bsalaris|\btoeslag|\bbelasting/, spot: "geld" },
  { re: /\b(getal|getallen|nummer)\b/, spot: "getallen" },
  { re: /\bhoe laat\b|\bkwart (over|voor)\b|\bhalf (een|één|twee|drie|vier|vijf|zes|zeven|acht|negen|tien|elf|twaalf)\b|\d\.\d\d uur|\bklok\b/, spot: "klok" },
  {
    re: /\b(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag|weekend|januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december|datum|kalender|feestdag|morgen|gisteren|overmorgen)\b/,
    spot: "kalender",
    promptOnly: true,
  },
];

/**
 * When a question is about nothing in particular: drawings that fit the whole topic (by the start of a tag).
 * Elsewhere (grammar, reading, writing) only people, so an object or animal is never mistaken for a hint.
 */
const BY_TOPIC: [string, string[]][] = [
  ["knm:gezondheid", ["dokter"]],
  ["knm:wonen", ["huis"]],
  ["knm:werk", ["laptop", "uitleggen"]],
  ["knm:onderwijs", ["boek", "diploma"]],
  ["knm:geschiedenis", ["molen", "tulpen"]],
  ["knm:staat", ["wijzen", "uitleggen"]],
  ["knm:instanties", ["brief", "lezen"]],
  ["knm:omgang", ["uitleggen", "denken"]],
  ["basis:tijd", ["klok"]],
  ["basis:voorzetsels", ["fietser", "lopen", "wijzen"]],
];
const PEOPLE = ["uitleggen", "idee", "denken", "wijzen", "lezen", "laptop"];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** The question itself, apart from its prompt: not the options, the answer or the listening text. */
function questionRest(e: Exercise): string {
  const parts = [e.context ?? ""];
  if (e.type === "true-false") parts.push(e.statement);
  if (e.type === "gap-fill" || e.type === "gap-choice") parts.push(e.text);
  if (e.type === "form-fill") parts.push(e.scenario);
  if (e.type === "writing") parts.push(e.task.scenario);
  return parts.join(" ").toLowerCase();
}

/** What the question is about: first what its prompt names, then the rest of the question. */
function aboutSpot(e: Exercise): string | undefined {
  // A list in brackets gives the choices ("Vul in (komen, werken, bellen)"): a drawing of one would be a hint.
  const prompt = e.prompt.toLowerCase().replace(/\([^)]*,[^)]*\)/g, "");
  const rest = questionRest(e);
  return ABOUT.find(({ re }) => re.test(prompt))?.spot ?? ABOUT.find(({ re, promptOnly }) => !promptOnly && re.test(rest))?.spot;
}

/**
 * The drawing next to an exercise: the one the course names; else one of the things the question is about;
 * else one that fits its topic. The choice depends only on the exercise, so the same question always shows
 * the same drawing, on the same side.
 */
export function spotFor(exercise: Exercise): SpotPicture | null {
  const h = hash(exercise.id);
  const side = h % 2 ? "left" : "right";
  const pool = BY_TOPIC.find(([prefix]) => exercise.tags.some((t) => t.startsWith(prefix)))?.[1] ?? PEOPLE;
  const found = spot(exercise.spot ?? aboutSpot(exercise)) ?? spot(pool[Math.floor(h / 2) % pool.length]);
  return found && { ...found, side };
}

// ----- warming up: download and decode pictures before they are shown, so they appear without a blank moment -----

/** Kept so the decoded pictures stay in memory. */
const warmed = new Map<string, HTMLImageElement>();

export function warmImages(urls: (string | undefined)[]) {
  if (typeof Image === "undefined") return;
  for (const url of urls) {
    if (!url || warmed.has(url)) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    warmed.set(url, img);
    void img.decode().catch(() => warmed.delete(url));
  }
}

export const warmScenes = (ids: (string | undefined)[]) => warmImages(ids.map((id) => scene(id)?.url));

/** The pictures inside a lesson (after its cover) and the drawings beside its exercises. */
export function warmUnit(unit: Unit) {
  const urls: (string | undefined)[] = [];
  for (const step of unit.steps) {
    if (step.type === "lesson") for (const b of step.blocks) if (b.kind === "picture") urls.push(scene(b.scene)?.url);
    if (step.type === "exercise") urls.push(spotFor(step.exercise)?.url);
  }
  warmImages(urls);
}
