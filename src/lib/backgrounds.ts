// Every image in src/assets named bg*.jpg (plus the original tulips) can be a dashboard background.
// Only the URLs are collected here: the browser downloads just the one that is shown.
const found = import.meta.glob<string>("../assets/{bg*,tulips*}.jpg", { eager: true, query: "?url", import: "default" });

export const backgrounds = Object.entries(found)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, url]) => url);

const LAST_KEY = "dashboardBackground";
const ready = new Set<string>();
let queued: string | null = null;

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
  let last = -1;
  try {
    last = Number(localStorage.getItem(LAST_KEY) ?? -1);
  } catch {
    // storage blocked: a repeat is not a problem
  }
  let next = Math.floor(Math.random() * backgrounds.length);
  if (next === last) next = (next + 1 + Math.floor(Math.random() * (backgrounds.length - 1))) % backgrounds.length;
  try {
    localStorage.setItem(LAST_KEY, String(next));
  } catch {
    // ignore
  }
  return backgrounds[next];
}

/** Choose the next dashboard background and start downloading it (called once at app start). */
export function primeBackground() {
  queued ??= randomOther();
  preload(queued);
}

/** A random background that is not the one shown last time; the one after it is preloaded already. */
export function pickBackground(): string {
  const current = queued ?? randomOther();
  queued = randomOther();
  preload(current);
  preload(queued);
  return current;
}
