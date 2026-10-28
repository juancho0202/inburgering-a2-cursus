/**
 * The landing page in index.html (see scripts/landingPage.ts) shows on "/" until this device has started.
 * public/boot.js reads the same key before the first paint and sets the `app` class when the landing page is skipped.
 */
const STARTED_KEY = "appStarted";

export const showsLanding = () => !document.documentElement.classList.contains("app");

function rememberStarted() {
  try {
    localStorage.setItem(STARTED_KEY, "1");
  } catch {
    // storage blocked: the landing page shows again next time, and its start link still works
  }
}

/**
 * Mounts the app, unless the landing page is showing: then the app waits for the start link (a normal page load).
 * A learner from before the landing page has no key yet; `isReturning` finds them so they skip it from now on.
 */
export async function startApp(mount: () => void, isReturning: () => Promise<boolean>) {
  if (!showsLanding()) {
    rememberStarted();
    mount();
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
  mount();
}
