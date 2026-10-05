import type { Env } from "@shared/services/context";
import { loadCourseContent } from "../content";
import { createDexieStore } from "../db/dexieStore";

let envPromise: Promise<Env> | null = null;

/**
 * What the services need, made once: the browser database and the bundled course.
 * `gateway` stays empty until the learner's own API key is set up (step 4); without it the
 * Claude features answer "Voeg een API-sleutel toe bij Instellingen".
 */
export function getEnv(): Promise<Env> {
  envPromise ??= loadCourseContent().then(({ content }) => ({ store: createDexieStore(), content }));
  return envPromise;
}
