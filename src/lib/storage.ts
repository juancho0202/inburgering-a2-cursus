/** Persistent storage: asks the browser not to clear the learner's progress when space runs low. */
export interface StorageStatus {
  persisted: boolean | null;
  usedMb: number | null;
  quotaMb: number | null;
}

export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

export async function storageStatus(): Promise<StorageStatus> {
  try {
    const persisted = navigator.storage?.persisted ? await navigator.storage.persisted() : null;
    const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
    const mb = (n?: number) => (n === undefined ? null : Math.round((n / 1_048_576) * 10) / 10);
    return { persisted, usedMb: mb(est?.usage), quotaMb: mb(est?.quota) };
  } catch {
    return { persisted: null, usedMb: null, quotaMb: null };
  }
}

/** Is the app running as an installed app (home-screen icon) and not in a browser tab? */
export const isInstalled = () => window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
