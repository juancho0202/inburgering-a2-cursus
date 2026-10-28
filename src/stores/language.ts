import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { i18n, rememberLanguage, startLanguage, type UiLanguage } from "../i18n";
import { GLOSSARY } from "../i18n/glossary";
import { useSettingsStore } from "./settings";
import { useVocabStore } from "./vocab";

type Params = Record<string, unknown>;
/** How a label is shown: only Dutch, only the learner's language, or Dutch with the learner's language too. */
export type LabelMode = "nl" | "own" | "both";
/**
 * Where a label sits. "button" (buttons, menu items) and "heading": Dutch with the learner's language in small under
 * it (centred under a button, aligned like the heading under a heading). "inline" (in a sentence, a chip, a table
 * header): no room for a second line, so the learner's language until its words are learned.
 */
export type LabelVariant = "button" | "heading" | "inline";

/**
 * Which language the app's own text is shown in. Layers (see SPEC.md §11.4):
 * - learning material (exercises, lessons, words, exams) is always Dutch and never goes through here;
 * - labels (buttons, menus, headings) follow the immersion level, see `labelMode`;
 * - longer text (help, hints) is in the learner's language at levels 0 and 1, Dutch at level 2.
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
  /** 0 = my language, 1 = Dutch with my language, 2 = Dutch only. */
  const immersion = computed(() => Math.min(settings.settings?.immersion ?? 1, 2));
  /** Set on pages that are Dutch only, whatever the level (the mock exam, like the real one). */
  const dutchOnly = ref(false);

  const isDutch = computed(() => locale.value === "nl");
  const level = computed(() => (dutchOnly.value ? 2 : immersion.value));
  /** Language of longer text, and of the page as a whole (`<html lang>`). */
  const proseLocale = computed<UiLanguage>(() => (isDutch.value || level.value >= 2 ? "nl" : locale.value));

  const learned = computed(() => new Set(vocab.themes.flatMap((t) => t.entries.filter((e) => e.state === "learned").map((e) => e.id))));
  const graduated = (key: string) => !!GLOSSARY[key]?.length && GLOSSARY[key].every((id) => learned.value.has(id));

  /** A label whose words are learned is Dutch at every level: the app becomes more Dutch as the learner learns. */
  function labelMode(key: string, variant: LabelVariant = "button"): LabelMode {
    if (isDutch.value || level.value >= 2 || graduated(key)) return "nl";
    return level.value === 0 || variant === "inline" ? "own" : "both";
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
    if (isDutch.value || immersion.value >= 2) return;
    try {
      await vocab.load(true);
    } catch {
      // without the word list every label keeps its translation
    }
  }

  return { preselected, locale, chosen, immersion, dutchOnly, isDutch, level, proseLocale, labelMode, graduated, t, nl, own, tIn, feedbackOwn, feedback, choose, loadLearned };
});
