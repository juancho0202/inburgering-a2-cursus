<script setup lang="ts">
import { computed } from "vue";
import { useLanguageStore, type LabelVariant } from "../../stores/language";

// A short piece of the app's own text. Depending on the immersion level (and on whether its words are learned) it is
// Dutch, the learner's language, or Dutch with the learner's language in small under it (see LabelVariant).
const props = withDefaults(defineProps<{ k: string; params?: Record<string, unknown>; count?: number; variant?: LabelVariant }>(), { variant: "button" });
const lang = useLanguageStore();
const mode = computed(() => lang.labelMode(props.k, props.variant));
const dutch = computed(() => lang.nl(props.k, props.params, props.count));
const own = computed(() => lang.own(props.k, props.params, props.count));
</script>

<template>
  <span v-if="mode === 'own'" :lang="lang.locale">{{ own }}</span>
  <span v-else-if="mode === 'nl' || dutch === own" lang="nl" translate="no">{{ dutch }}</span>
  <!-- A heading keeps its own alignment (left, or centred): the second line is a block under it -->
  <span v-else-if="variant === 'heading'"><span lang="nl" translate="no">{{ dutch }}</span><span class="ui-sub block text-[0.6em]" :lang="lang.locale">{{ own }}</span></span>
  <span v-else class="ui-stack"><span lang="nl" translate="no">{{ dutch }}</span><span class="ui-sub" :lang="lang.locale">{{ own }}</span></span>
</template>
