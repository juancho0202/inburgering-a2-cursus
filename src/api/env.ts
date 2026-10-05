import { createBrowserGateway, testApiKey } from "@shared/claude/browserGateway";
import { createKeyVault } from "@shared/claude/keyVault";
import type { RouterOptions } from "@shared/services/router";
import type { Env } from "@shared/services/context";
import { getSettings } from "@shared/services/settings";
import { loadCourseContent } from "../content";
import { createDexieStore } from "../db/dexieStore";
import { createDexieSecretBackend } from "../db/secretBackend";

/** The learner's API key: encrypted on this device, never part of the progress data. */
export const keyVault = createKeyVault(createDexieSecretBackend());

let envPromise: Promise<Env> | null = null;

/**
 * What the services need, made once: the browser database, the bundled course and the Claude gateway.
 * The gateway reads the key from the vault only at the moment of a request. Without a key it throws
 * NoApiKeyError, which the services turn into "Voeg een API-sleutel toe bij Instellingen".
 */
export function getEnv(): Promise<Env> {
  envPromise ??= loadCourseContent().then(({ content }) => {
    const env: Env = { store: createDexieStore(), content };
    env.gateway = () =>
      createBrowserGateway({
        getKey: () => keyVault.load(),
        getModel: async () => (await getSettings(env)).model,
      });
    return env;
  });
  return envPromise;
}

/** What the settings routes need from outside the data store. */
export const routerOptions: RouterOptions = {
  maskedKey: () => keyVault.masked(),
  saveKey: (apiKey) => keyVault.save(apiKey),
  removeKey: () => keyVault.remove(),
  async testKey() {
    const apiKey = await keyVault.load();
    if (!apiKey) return { ok: false, message: "Voeg eerst een API-sleutel toe." };
    return testApiKey(apiKey, (await getSettings(await getEnv())).model);
  },
};
