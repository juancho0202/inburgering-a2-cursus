import { createI18n } from "vue-i18n";
import { UI_LANGUAGES, type UiLanguage } from "@shared/schemas/store";
import nl, { type Messages } from "./messages/nl";
import en from "./messages/en";
import es from "./messages/es";

export type { UiLanguage };

/** The languages in the picker, each named in its own language. `dir` is ready for right-to-left languages. */
export const LANGUAGES: { code: UiLanguage; name: string; flag: string; dir: "ltr" | "rtl" }[] = [
  { code: "en", name: "English", flag: "🇬🇧", dir: "ltr" },
  { code: "nl", name: "Nederlands", flag: "🇳🇱", dir: "ltr" },
  { code: "es", name: "Español", flag: "🇪🇸", dir: "ltr" },
];
export const DEFAULT_LANGUAGE: UiLanguage = "en";

const messages: Record<UiLanguage, Messages> = { nl, en, es };

// Components never use the global locale: every call names the language it wants (Dutch, the learner's, or both).
export const i18n = createI18n({ legacy: false, locale: "nl", fallbackLocale: "en", messages, missingWarn: false, fallbackWarn: false });

export const isUiLanguage = (x: unknown): x is UiLanguage => UI_LANGUAGES.includes(x as UiLanguage);

/** The first supported language in the browser's list ("es-AR" counts as "es"). */
export function browserLanguage(languages: readonly string[] = navigator.languages ?? [navigator.language]): UiLanguage | null {
  for (const l of languages) {
    const code = l?.slice(0, 2).toLowerCase();
    if (isUiLanguage(code)) return code;
  }
  return null;
}

// The language last used on this device, so the app does not start in the wrong one while the settings load.
const MIRROR_KEY = "uiLanguage";
export function rememberedLanguage(): UiLanguage | null {
  try {
    const v = localStorage.getItem(MIRROR_KEY);
    return isUiLanguage(v) ? v : null;
  } catch {
    return null;
  }
}
export function rememberLanguage(lang: UiLanguage) {
  try {
    localStorage.setItem(MIRROR_KEY, lang);
  } catch {
    // only a convenience: the setting itself is saved with the other settings
  }
}

let requested: UiLanguage | null = null;
/**
 * The language landing pages link to /?lang=xx. Read it once at start, and take it out of the address so it is not
 * bookmarked or shared. It only preselects the first-visit picker; a language the learner chose always wins.
 */
export function takeLanguageParam(loc: Location = window.location, history: History = window.history) {
  const url = new URL(loc.href);
  if (!url.searchParams.has("lang")) return;
  const value = url.searchParams.get("lang")?.toLowerCase();
  if (isUiLanguage(value)) requested = value;
  url.searchParams.delete("lang");
  history.replaceState(history.state, "", url.pathname + url.search + url.hash);
}
export const requestedLanguage = () => requested;
/** For tests. */
export const resetRequestedLanguage = () => (requested = null);

/** The language to show before the learner has chosen one. */
export const startLanguage = (): UiLanguage => rememberedLanguage() ?? requested ?? browserLanguage() ?? DEFAULT_LANGUAGE;

export const flagOf = (lang: UiLanguage) => LANGUAGES.find((l) => l.code === lang)?.flag ?? "🌐";
export const dirOf = (lang: UiLanguage) => LANGUAGES.find((l) => l.code === lang)?.dir ?? "ltr";
