<script setup lang="ts">
import { computed } from "vue";
import { useLanguageStore } from "../../stores/language";
import { renderMdInline } from "../../composables/markdown";

// Longer app text (help, hints) in the language of the page. With `md`, **bold** in the message is shown bold;
// markdown-it has html off, so a value put into the message can never become markup.
const props = defineProps<{ k: string; params?: Record<string, unknown>; count?: number; md?: boolean }>();
const lang = useLanguageStore();
const text = computed(() => lang.t(props.k, props.params, props.count));
</script>

<template>
  <span v-if="md" :lang="lang.proseLocale" v-html="renderMdInline(text)" />
  <span v-else :lang="lang.proseLocale">{{ text }}</span>
</template>
