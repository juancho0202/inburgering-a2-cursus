/**
 * The landing page in index.html (see scripts/site.ts) shows on "/" until this device has started.
 * public/boot.js reads the same key before the first paint and sets the `app` class when the landing page is skipped.
 */
import type { UiLanguage } from "@shared/schemas/store";

const STARTED_KEY = "appStarted";
/** The app's database (src/db/dexieStore.ts). */
const DB_NAME = "inburgering-a2";

/**
 * The landing page for a learner who has started, in their language. "/" is the app for them, so English has a copy
 * at /landing/ (scripts/site.ts); the other languages' landing pages are pages of their own already.
 */
export const landingPageFor = (lang: UiLanguage) => (lang === "en" ? "/landing/" : `/${lang}/`);

export const showsLanding = () => !document.documentElement.classList.contains("app");

function rememberStarted() {
  try {
    localStorage.setItem(STARTED_KEY, "1");
  } catch {
    // storage blocked: the landing page shows again next time, and its start link still works
  }
}

/**
 * Could this device have used the app before? Only then is the app worth downloading to ask it. New visitors and
 * search engines have no database, so the landing page stays light for them. Without the list, assume it could.
 */
export async function hasLocalData(idb: IDBFactory | undefined = globalThis.indexedDB): Promise<boolean> {
  if (!idb) return false;
  if (typeof idb.databases !== "function") return true;
  try {
    return (await idb.databases()).some((d) => d.name === DB_NAME);
  } catch {
    return true;
  }
}

/**
 * Mounts the app, unless the landing page is showing: then the app waits for the start link (a normal page load).
 * A learner from before the landing page has no key yet; `isReturning` finds them so they skip it from now on.
 */
export async function startApp(mount: () => void | Promise<void>, isReturning: () => Promise<boolean>) {
  if (!showsLanding()) {
    rememberStarted();
    await mount();
    return;
  }
  let returning = false;
  try {
    returning = await isReturning();
  } catch {
    // no database: stay on the landing page
  }
  if (!returning) return;
  rememberStarted();
  document.documentElement.classList.add("app");
  await mount();
}
