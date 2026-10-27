import type { InjectionKey } from "vue";
import type { Exercise } from "@shared/types";
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

/** Drawings that suit a topic, by the start of an exercise tag (the first match wins). */
const BY_TOPIC: [string, string[]][] = [
  ["knm:gezondheid", ["dokter", "medicijnen", "bellen", "telefoon"]],
  ["knm:wonen", ["huis", "sleutels", "verhuisdoos", "plant"]],
  ["knm:werk", ["laptop", "computer", "koffie", "uitleggen"]],
  ["knm:onderwijs", ["boek", "diploma", "idee", "fietser"]],
  ["knm:geschiedenis", ["molen", "tulpen", "koe", "eend"]],
  ["knm:staat", ["stembus", "wijzen", "uitleggen"]],
  ["knm:instanties", ["brief", "bellen", "kalender", "lezen"]],
  ["knm:omgang", ["bloemen", "koffie", "uitleggen", "oma"]],
  ["basis:tijd", ["klok", "kalender", "geld"]],
  ["basis:voorzetsels", ["fietser", "fiets", "lopen", "wijzen"]],
  ["lezen", ["lezen", "brief", "boek", "bellen"]],
  ["schrijven", ["laptop", "brief", "computer", "denken"]],
];
const EVERYDAY = ["uitleggen", "idee", "denken", "wijzen", "lopen", "oma", "fietser", "rolstoel", "hond", "kat", "koe", "eend", "koffie", "bellen", "lezen", "laptop", "fiets", "tulpen"];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * The drawing next to an exercise: the one the course names, or else one that suits its topic.
 * The choice depends only on the exercise id, so the same question always shows the same drawing,
 * on the same side.
 */
export function spotFor(exercise: Pick<Exercise, "id" | "tags" | "spot">): SpotPicture | null {
  const h = hash(exercise.id);
  const side = h % 2 ? "left" : "right";
  const chosen = spot(exercise.spot);
  if (chosen) return { ...chosen, side };
  const pool = BY_TOPIC.find(([prefix]) => exercise.tags.some((t) => t.startsWith(prefix)))?.[1] ?? EVERYDAY;
  const found = spot(pool[Math.floor(h / 2) % pool.length]);
  return found && { ...found, side };
}
