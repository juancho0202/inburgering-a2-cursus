<script setup lang="ts">
import { LANGUAGES } from "../i18n";
import { useLanguageStore } from "../stores/language";
import UiLabel from "./ui/UiLabel.vue";
import UiText from "./ui/UiText.vue";

// Each language is named in its own language, so a learner who reads none of the others still finds theirs.
const lang = useLanguageStore();
</script>

<template>
  <div>
    <h2 id="language-title" class="text-xl font-bold"><span aria-hidden="true">🌐 </span><UiLabel k="language.choose" /></h2>
    <div class="mt-3 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-labelledby="language-title">
      <button
        v-for="l in LANGUAGES"
        :key="l.code"
        type="button"
        role="radio"
        :lang="l.code"
        :dir="l.dir"
        :aria-checked="lang.locale === l.code"
        class="rounded-2xl border-2 px-4 py-3 text-lg font-bold transition"
        :class="lang.locale === l.code ? 'border-brand bg-brand-bg text-brand-strong' : 'border-line hover:border-brand'"
        @click="lang.choose(l.code)"
      >
        {{ l.name }}
      </button>
    </div>
    <p v-if="!lang.isDutch" class="mt-2 text-sm text-muted"><UiText k="language.dutchStays" /></p>
  </div>
</template>
