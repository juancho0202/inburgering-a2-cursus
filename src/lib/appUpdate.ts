import { ref } from "vue";
import { registerSW } from "virtual:pwa-register";

/** A new version has been downloaded and is waiting; UpdateBanner offers to switch to it. */
export const updateReady = ref(false);

let activate: ((reload?: boolean) => Promise<void>) | undefined;
const HOUR = 60 * 60 * 1000;

/**
 * Registers the service worker and keeps looking for a new version. Browsers only look by themselves when a page
 * is loaded, and a phone brings a tab or installed app back from the background without loading it, so we also
 * look every time the app becomes visible again, and every hour while it stays open.
 */
export function watchForUpdates() {
  activate = registerSW({
    onNeedRefresh: () => (updateReady.value = true),
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Offline the check can only fail. A failed check (bad connection) is fine too: the next one catches up,
      // so the catch only keeps it out of the console as an uncaught error.
      const check = () => navigator.onLine && registration.update().catch(() => {});
      document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && check());
      setInterval(check, HOUR);
    },
  });
}

/** "Later": hide the offer for now. The waiting version is offered again the next time the app starts. */
export function dismissUpdate() {
  updateReady.value = false;
}

/** Lets the waiting version take over and reloads the page into it. Progress is in IndexedDB, so nothing is lost. */
export function installUpdate() {
  updateReady.value = false;
  void activate?.(true);
}
