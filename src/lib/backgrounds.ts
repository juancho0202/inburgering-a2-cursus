// Every image in src/assets named bg*.jpg (plus the original tulips) can be a dashboard background.
// Only the URLs are collected here: the browser downloads just the one that is shown.
const found = import.meta.glob<string>("../assets/{bg*,tulips*}.jpg", { eager: true, query: "?url", import: "default" });

export const backgrounds = Object.entries(found)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, url]) => url);

const LAST_KEY = "dashboardBackground";
const started = new Set<string>();
const ready = new Set<string>();
let queued: number | null = null;

/** Download and decode an image ahead of time, so it can be shown without a blank moment. */
function preload(url: string) {
  if (!url || started.has(url) || typeof Image === "undefined") return;
  started.add(url);
  const img = new Image();
  img.src = url;
  img.decode().then(
    () => ready.add(url),
    () => started.delete(url), // a failed download may be tried again later
  );
}

/** True when the image is already downloaded, so it can appear instantly. */
export function isBackgroundReady(url: string): boolean {
  return ready.has(url);
}

/** The picture shown last time, remembered on this device (-1 when unknown or storage is blocked). */
function lastShown(): number {
  try {
    return Number(localStorage.getItem(LAST_KEY) ?? -1);
  } catch {
    return -1;
  }
}

function remember(index: number) {
  try {
    localStorage.setItem(LAST_KEY, String(index));
  } catch {
    // storage blocked: a repeat is not a problem
  }
}

/** A random picture index that is not `avoid`. */
function randomOther(avoid: number): number {
  if (backgrounds.length <= 1) return 0;
  const next = Math.floor(Math.random() * backgrounds.length);
  return next === avoid ? (next + 1 + Math.floor(Math.random() * (backgrounds.length - 1))) % backgrounds.length : next;
}

const urlOf = (index: number) => backgrounds[index] ?? "";

/** Choose the next dashboard background and start downloading it (called once at app start). */
export function primeBackground() {
  queued ??= randomOther(lastShown());
  preload(urlOf(queued));
}

/** A random background that is not the one shown last time; the one after it is preloaded already. */
export function pickBackground(): string {
  const current = queued ?? randomOther(lastShown());
  remember(current);
  queued = randomOther(current);
  preload(urlOf(current));
  preload(urlOf(queued));
  return urlOf(current);
}
