<script setup lang="ts">
import { computed } from "vue";
import { useLanguageStore } from "../../stores/language";

// A short piece of the app's own text (button, menu item, heading). Depending on the immersion level it is Dutch,
// the learner's language, or Dutch with the learner's language next to it, so every click shows a Dutch word.
const props = defineProps<{ k: string; params?: Record<string, unknown>; count?: number }>();
const lang = useLanguageStore();
const mode = computed(() => lang.labelMode(props.k));
const dutch = computed(() => lang.nl(props.k, props.params, props.count));
const own = computed(() => lang.own(props.k, props.params, props.count));
</script>

<template>
  <span v-if="mode === 'own'" :lang="lang.locale">{{ own }}</span>
  <span v-else-if="mode === 'nl' || dutch === own" lang="nl" translate="no">{{ dutch }}</span>
  <span v-else class="ui-both"><span lang="nl" translate="no">{{ dutch }}</span> <span class="ui-gloss" :lang="lang.locale">{{ own }}</span></span>
</template>
