<script setup lang="ts">
import { computed } from "vue";
import type { WritingFeedback } from "@shared/schemas/claude";
import { buildSegments } from "@shared/logic/corrections";
import type { CorrectionTips } from "../composables/useCorrectionTip";

/** The learner's text with each correction in place: tap, hover or focus it for the explanation (a CorrectionTooltip). */
const props = defineProps<{ text: string; corrections: WritingFeedback["corrections"]; tips: CorrectionTips; m?: number }>();
const m = computed(() => props.m ?? 0);
const segments = computed(() => buildSegments(props.text, props.corrections));
</script>

<template>
  <template v-for="(s, si) in segments" :key="si">
    <span v-if="s.kind === 'text'">{{ s.text }}</span>
    <!-- display: inline, so a correction wraps with the sentence like the rest of the text -->
    <button
      v-else
      type="button"
      :data-fix="`${m}-${s.index}`"
      class="inline cursor-help rounded text-left focus-visible:outline-2 focus-visible:outline-brand"
      :aria-expanded="tips.isOpen(m, s.index)"
      :aria-describedby="tips.isOpen(m, s.index) ? tips.tipId(m, s.index) : undefined"
      @pointerenter="tips.hoverIn($event, m, s.index)"
      @pointerleave="tips.hoverOut"
      @focus="tips.onFocus(m, s.index)"
      @blur="tips.onBlur($event, m, s.index)"
      @click="tips.onTap(m, s.index)"
    >
      <del class="rounded bg-bad-bg px-0.5 text-bad line-through">{{ s.original }}</del>
      <ins class="ml-1 rounded bg-good-bg px-0.5 font-semibold text-good underline decoration-dotted underline-offset-4">{{ s.corrected }}</ins>
    </button>
  </template>
</template>
