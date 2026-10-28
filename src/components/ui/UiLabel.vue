<script setup lang="ts">
import { computed, ref } from "vue";
import { flagOf } from "../../i18n";
import { useLanguageStore, type LabelVariant } from "../../stores/language";

// A short piece of the app's own text. Depending on the immersion level (and on whether its words are learned) it is
// Dutch, the learner's language, or Dutch with the learner's language too. How "too" looks depends on where it sits
// (see LabelVariant): a second line under a button, or a flag after a heading that switches just that heading.
const props = withDefaults(defineProps<{ k: string; params?: Record<string, unknown>; count?: number; variant?: LabelVariant }>(), { variant: "button" });
const lang = useLanguageStore();
const mode = computed(() => lang.labelMode(props.k, props.variant));
const dutch = computed(() => lang.nl(props.k, props.params, props.count));
const own = computed(() => lang.own(props.k, props.params, props.count));
/** A heading switched to the learner's language with its flag. */
const flipped = ref(false);
</script>

<template>
  <span v-if="mode === 'own'" :lang="lang.locale">{{ own }}</span>
  <span v-else-if="mode === 'nl' || dutch === own" lang="nl" translate="no">{{ dutch }}</span>
  <span v-else-if="variant === 'heading'">
    <span v-if="flipped" :lang="lang.locale">{{ own }}</span>
    <span v-else lang="nl" translate="no">{{ dutch }}</span>
    <button
      type="button"
      class="ui-flag"
      :aria-pressed="flipped"
      :aria-label="lang.own(flipped ? 'feedback.inDutch' : 'feedback.inMyLanguage')"
      :title="lang.own(flipped ? 'feedback.inDutch' : 'feedback.inMyLanguage')"
      @click.stop.prevent="flipped = !flipped"
    >
      {{ flipped ? flagOf("nl") : flagOf(lang.locale) }}
    </button>
  </span>
  <span v-else class="ui-stack"><span lang="nl" translate="no">{{ dutch }}</span><span class="ui-sub" :lang="lang.locale">{{ own }}</span></span>
</template>
