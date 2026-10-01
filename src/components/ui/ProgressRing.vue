<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ value: number; size?: number }>();
const size = computed(() => props.size ?? 96);
const r = computed(() => size.value / 2 - 8);
const c = computed(() => 2 * Math.PI * r.value);
const offset = computed(() => c.value * (1 - Math.min(1, Math.max(0, props.value))));
</script>

<template>
  <div class="relative inline-grid place-items-center" :style="{ width: `${size}px`, height: `${size}px` }">
    <svg :width="size" :height="size" class="-rotate-90" aria-hidden="true">
      <circle :cx="size / 2" :cy="size / 2" :r="r" fill="none" stroke="var(--surface-2)" stroke-width="10" />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="r"
        fill="none"
        stroke="var(--brand)"
        stroke-width="10"
        stroke-linecap="round"
        :stroke-dasharray="c"
        :stroke-dashoffset="offset"
        class="transition-all duration-500"
      />
    </svg>
    <div class="absolute inset-0 grid place-items-center text-center"><slot /></div>
  </div>
</template>
