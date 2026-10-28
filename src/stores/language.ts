import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { i18n, rememberLanguage, startLanguage, type UiLanguage } from "../i18n";
import { GLOSSARY } from "../i18n/glossary";
import { useSettingsStore } from "./settings";
import { useVocabStore } from "./vocab";

type Params = Record<string, unknown>;
/** How a label is shown: only Dutch, only the learner's language, or Dutch with the learner's language next to it. */
export type LabelMode = "nl" | "own" | "both";

/**
 * Which language the app's own text is shown in. Three layers (see SPEC.md, "Languages"):
 * - learning material (exercises, lessons, words, exams) is always Dutch and never goes through here;
 * - labels (buttons, menus, headings) follow the immersion level, see `labelMode`;
 * - longer text (help, hints) is in the learner's language up to level 1 and Dutch from level 2.
 * Feedback after an answer is Dutch first; `feedback` gives the learner's language when they asked for it.
 */
export const useLanguageStore = defineStore("language", () => {
  const settings = useSettingsStore();
  const vocab = useVocabStore();

  /** Shown until the learner chooses: this device's last language, the landing page's ?lang=, the browser's, or English. */
  const preselected = ref<UiLanguage>(startLanguage());
  const locale = computed<UiLanguage>(() => settings.settings?.language ?? preselected.value);
  /** False until the learner has picked a language (only known once the settings are loaded). */
  const chosen = computed(() => !!settings.settings?.language);
  const immersion = computed(() => settings.settings?.immersion ?? 1);
  /** Level 2: "Vertaling" shows the translations for a moment. */
  const peek = ref(false);
  /** Set on pages that are Dutch only, whatever the level (the mock exam, like the real one). */
  const dutchOnly = ref(false);

  const isDutch = computed(() => locale.value === "nl");
  const level = computed(() => (dutchOnly.value ? 3 : immersion.value === 2 && peek.value ? 1 : immersion.value));
  /** Language of longer text, and of the page as a whole (`<html lang>`). */
  const proseLocale = computed<UiLanguage>(() => (isDutch.value || level.value >= 2 ? "nl" : locale.value));

  const learned = computed(() => new Set(vocab.themes.flatMap((t) => t.entries.filter((e) => e.state === "learned").map((e) => e.id))));
  const graduated = (key: string) => !!GLOSSARY[key]?.length && GLOSSARY[key].every((id) => learned.value.has(id));

  function labelMode(key: string): LabelMode {
    if (isDutch.value || level.value >= 2) return "nl";
    if (level.value === 0) return "own";
    return graduated(key) ? "nl" : "both";
  }

  const tIn = (lang: UiLanguage, key: string, params: Params = {}, count?: number) =>
    count === undefined ? i18n.global.t(key, params, { locale: lang }) : i18n.global.t(key, params, { locale: lang, plural: count });
  /** Longer text (and attributes such as aria-label) in the language of the page. */
  const t = (key: string, params?: Params, count?: number) => tIn(proseLocale.value, key, params, count);
  const nl = (key: string, params?: Params, count?: number) => tIn("nl", key, params, count);
  const own = (key: string, params?: Params, count?: number) => tIn(locale.value, key, params, count);

  /** Feedback is Dutch unless the learner pressed "In mijn taal" (remembered in the settings). */
  const feedbackOwn = computed(() => !isDutch.value && !dutchOnly.value && !!settings.settings?.feedbackInMyLanguage);
  const feedback = (key: string, params?: Params, count?: number) => (feedbackOwn.value ? own(key, params, count) : nl(key, params, count));

  async function choose(lang: UiLanguage) {
    preselected.value = lang;
    rememberLanguage(lang);
    try {
      if (!settings.settings) await settings.load();
      await settings.update({ language: lang });
    } catch {
      // still shown in this language on this device (remembered above); the picker comes back until it is saved
    }
  }

  /** Which words are learned, for labels that graduate to Dutch only. Not needed (and not loaded) otherwise. */
  async function loadLearned() {
    if (isDutch.value || immersion.value !== 1) return;
    try {
      await vocab.load(true);
    } catch {
      // without the word list every label keeps its translation
    }
  }

  return { preselected, locale, chosen, immersion, peek, dutchOnly, isDutch, level, proseLocale, labelMode, graduated, t, nl, own, tIn, feedbackOwn, feedback, choose, loadLearned };
});
