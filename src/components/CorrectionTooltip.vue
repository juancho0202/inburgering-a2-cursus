<script setup lang="ts">
import type { CorrectionTips } from "../composables/useCorrectionTip";
import { useLanguageStore } from "../stores/language";

/** The one open explanation of a CorrectedText, placed above its chunk; goes inside the same positioned box. */
defineProps<{ tips: CorrectionTips }>();
const lang = useLanguageStore();
</script>

<template>
  <!-- Its triangle points at the chunk. Not role=tooltip: it has a button (✕), so it is a small note the chunk refers to with aria-describedby. -->
  <div
    v-if="tips.tip.value && tips.openCorrection.value"
    :id="tips.tipId(tips.tip.value.m, tips.tip.value.c)"
    data-tooltip
    class="card absolute z-20 -translate-y-full border-2 border-brand py-3 pl-4 pr-10 text-base shadow-lg"
    :style="{ left: `${tips.place.value.left}px`, top: `${tips.place.value.top}px`, width: tips.place.value.width ? `${tips.place.value.width}px` : undefined }"
    lang="nl"
    translate="no"
    @pointerenter="tips.keepTip"
    @pointerleave="tips.hoverOut"
  >
    <button
      type="button"
      class="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full text-lg text-muted hover:bg-surface-2 hover:text-ink"
      :aria-label="lang.t('common.close')"
      @click="tips.close(true)"
    >
      ✕
    </button>
    <p><del class="text-bad">{{ tips.openCorrection.value.original }}</del> → <strong class="text-good">{{ tips.openCorrection.value.corrected }}</strong></p>
    <p class="mt-1">{{ tips.openCorrection.value.explanation }}</p>
    <!-- The triangle: a turned square with the card's colour and the border on its two lower sides -->
    <span
      class="absolute -bottom-[9px] h-4 w-4 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-brand bg-surface"
      :style="{ left: `${tips.place.value.arrow}px` }"
      aria-hidden="true"
    />
  </div>
</template>
