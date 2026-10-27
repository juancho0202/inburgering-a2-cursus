// Every image in src/assets named bg*.webp (plus the original tulips) can be a dashboard background.
// Only the URLs are collected here: the browser downloads just the one that is shown.
const found = import.meta.glob<string>("../assets/{bg*,tulips*}.webp", { eager: true, query: "?url", import: "default" });

export const backgrounds = Object.entries(found)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, url]) => url);

const LAST_KEY = "dashboardBackground";
/** The background downloaded ahead of time, to show the next time the app starts (it is in the cache by then). */
const NEXT_KEY = "dashboardNextBackground";
const ready = new Set<string>();
let queued: string | null = null;

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
  if (!url || ready.has(url) || typeof Image === "undefined") return;
  const img = new Image();
  img.src = url;
  void img.decode().then(() => ready.add(url), () => undefined);
}

/** True when the image is already downloaded, so it can appear instantly. */
export function isBackgroundReady(url: string): boolean {
  return ready.has(url);
}

function randomOther(): string {
  if (backgrounds.length <= 1) return backgrounds[0] ?? "";
  const last = Number(load(LAST_KEY) ?? -1);
  let next = Math.floor(Math.random() * backgrounds.length);
  if (next === last) next = (next + 1 + Math.floor(Math.random() * (backgrounds.length - 1))) % backgrounds.length;
  save(LAST_KEY, String(next));
  return backgrounds[next];
}

/** Choose the next dashboard background and start downloading it (called once at app start). */
export function primeBackground() {
  // The one downloaded during the last visit is cached, so it shows at once (also after a reload).
  // A new version of the site has new file names: then pick another one.
  const saved = load(NEXT_KEY);
  queued ??= saved && backgrounds.includes(saved) ? saved : randomOther();
  preload(queued);
}

/** A random background that is not the one shown last time; the one after it is preloaded already. */
export function pickBackground(): string {
  const current = queued ?? randomOther();
  queued = randomOther();
  save(NEXT_KEY, queued);
  preload(current);
  preload(queued);
  return current;
}
