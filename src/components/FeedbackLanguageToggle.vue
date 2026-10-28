<script setup lang="ts">
import { useLanguageStore } from "../stores/language";
import { useSettingsStore } from "../stores/settings";

// Feedback is Dutch first. This switches it to the learner's language (and back); the choice is remembered.
// The button names itself in both languages, so it can be found whichever one is showing.
const lang = useLanguageStore();
const settings = useSettingsStore();
const toggle = () => settings.update({ feedbackInMyLanguage: !lang.feedbackOwn }).catch(() => {});
</script>

<template>
  <button
    v-if="!lang.isDutch && settings.settings"
    type="button"
    class="inline-flex items-center gap-1 rounded-xl border border-line bg-surface px-2.5 py-1 text-sm font-semibold text-muted transition hover:text-ink"
    :aria-pressed="lang.feedbackOwn"
    @click="toggle"
  >
    <span aria-hidden="true">🌐</span>
    <template v-if="lang.feedbackOwn"><span lang="nl">{{ lang.nl("feedback.inDutch") }}</span><span class="ui-gloss" :lang="lang.locale">· {{ lang.own("feedback.inDutch") }}</span></template>
    <template v-else><span lang="nl">{{ lang.nl("feedback.inMyLanguage") }}</span><span class="ui-gloss" :lang="lang.locale">· {{ lang.own("feedback.inMyLanguage") }}</span></template>
  </button>
</template>
