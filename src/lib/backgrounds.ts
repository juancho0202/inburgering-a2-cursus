import { whenDecoded } from "./images";

// Every image in src/assets named bg*.webp (plus the original tulips) can be a dashboard background.
// Only the URLs are collected here: the browser downloads just the one that is shown.
const found = import.meta.glob<string>("../assets/{bg*,tulips*}.webp", { eager: true, query: "?url", import: "default" });

export const backgrounds = Object.entries(found)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, url]) => url);

const LAST_KEY = "dashboardBackground";
/** The background downloaded ahead of time, to show the next time the app starts (it is in the cache by then). */
const NEXT_KEY = "dashboardNextBackground";
const started = new Set<string>();
const ready = new Set<string>();
let queued: number | null = null;

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null; // storage blocked: a background that is not cached yet is not a problem
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

/** Download and decode an image ahead of time, so it can be shown without a blank moment. */
function preload(url: string) {
  if (!url || started.has(url) || typeof Image === "undefined") return;
  started.add(url);
  const img = new Image();
  img.src = url;
  whenDecoded(img).then(
    () => ready.add(url),
    () => started.delete(url), // a failed download may be tried again later
  );
}

/** True when the image is already downloaded, so it can appear instantly. */
export function isBackgroundReady(url: string): boolean {
  return ready.has(url);
}

/** The picture shown last time, remembered on this device (-1 when unknown or storage is blocked). */
const lastShown = () => Number(load(LAST_KEY) ?? -1);

/** A random picture index that is not `avoid`. */
function randomOther(avoid: number): number {
  if (backgrounds.length <= 1) return 0;
  const next = Math.floor(Math.random() * backgrounds.length);
  return next === avoid ? (next + 1 + Math.floor(Math.random() * (backgrounds.length - 1))) % backgrounds.length : next;
}

const urlOf = (index: number) => backgrounds[index] ?? "";

/** Choose the next dashboard background and start downloading it (called once at app start). */
export function primeBackground() {
  // The one downloaded during the last visit is cached, so it shows at once (also after a reload).
  // A new version of the site has new file names: then pick another one.
  const last = lastShown();
  const saved = backgrounds.indexOf(load(NEXT_KEY) ?? "");
  queued ??= saved >= 0 && saved !== last ? saved : randomOther(last);
  preload(urlOf(queued));
}

/** A random background that is not the one shown last time; the one after it is preloaded already. */
export function pickBackground(): string {
  const current = queued ?? randomOther(lastShown());
  save(LAST_KEY, String(current));
  queued = randomOther(current);
  save(NEXT_KEY, urlOf(queued));
  preload(urlOf(current));
  preload(urlOf(queued));
  return urlOf(current);
}
