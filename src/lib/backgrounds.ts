// Every image in src/assets named bg*.jpg (plus the original tulips) can be a dashboard background.
// Only the URLs are collected here: the browser downloads just the one that is shown.
const found = import.meta.glob<string>("../assets/{bg*,tulips*}.jpg", { eager: true, query: "?url", import: "default" });

export const backgrounds = Object.entries(found)
  .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
  .map(([, url]) => url);

const LAST_KEY = "dashboardBackground";

/** A random background that is not the one shown last time (remembered on this device). */
export function pickBackground(): string {
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
