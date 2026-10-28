<script setup lang="ts">
import { flagOf } from "../i18n";
import { useLanguageStore } from "../stores/language";
import { useSettingsStore } from "../stores/settings";

// Feedback is Dutch first. This switches it to the learner's language (and back); the choice is remembered.
// The flag shows the language it switches to, and the button names itself in both languages.
const lang = useLanguageStore();
const settings = useSettingsStore();
const toggle = () => settings.update({ feedbackInMyLanguage: !lang.feedbackOwn }).catch(() => {});
</script>

<template>
  <button
    v-if="!lang.isDutch && settings.settings"
    type="button"
    class="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-2.5 py-1 text-sm font-semibold text-muted transition hover:text-ink"
    :aria-pressed="lang.feedbackOwn"
    @click="toggle"
  >
    <span aria-hidden="true">{{ lang.feedbackOwn ? flagOf("nl") : flagOf(lang.locale) }}</span>
    <span class="ui-stack">
      <span lang="nl">{{ lang.nl(lang.feedbackOwn ? "feedback.inDutch" : "feedback.inMyLanguage") }}</span>
      <span class="ui-sub" :lang="lang.locale">{{ lang.own(lang.feedbackOwn ? "feedback.inDutch" : "feedback.inMyLanguage") }}</span>
    </span>
  </button>
</template>
