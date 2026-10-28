<script setup lang="ts">
import { computed } from "vue";

// A speedometer for today's minutes: 0 on the left, the goal on the right. The goal is not a ceiling, so the
// number keeps counting past it while the needle rests at the end of the scale.
const props = defineProps<{ minutes: number; goal: number; size?: number }>();

const START = 150; // degrees, bottom left; the scale runs clockwise over the top to the bottom right
const SWEEP = 240;
const point = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  return { x: 50 + r * Math.cos(rad), y: 50 + r * Math.sin(rad) };
};
const from = point(START, 40);
const to = point(START + SWEEP, 40);
const arc = `M ${from.x} ${from.y} A 40 40 0 1 1 ${to.x} ${to.y}`;

const done = computed(() => Math.round(props.minutes));
const fraction = computed(() => (props.goal > 0 ? Math.min(1, Math.max(0, props.minutes / props.goal)) : 0));
const reached = computed(() => props.goal > 0 && props.minutes >= props.goal);
const angle = computed(() => START + SWEEP * fraction.value);
const tip = computed(() => point(angle.value, 30));
</script>

<template>
  <svg
    viewBox="0 0 100 92"
    :width="size ?? 96"
    :height="((size ?? 96) * 92) / 100"
    role="img"
    :aria-label="`${done} van ${goal} minuten`"
  >
    <path :d="arc" fill="none" stroke="var(--surface-2)" stroke-width="9" stroke-linecap="round" />
    <!-- Not drawn at 0: a round cap would still paint a dot. The gap of 2 keeps a second dash from showing at the end. -->
    <path
      v-if="fraction > 0"
      :d="arc"
      fill="none"
      :stroke="reached ? 'var(--good)' : 'var(--brand)'"
      stroke-width="9"
      stroke-linecap="round"
      pathLength="1"
      stroke-dasharray="1 2"
      :stroke-dashoffset="1 - fraction"
      class="transition-all duration-500"
    />
    <line x1="50" y1="50" :x2="tip.x" :y2="tip.y" stroke="var(--ink)" stroke-width="3" stroke-linecap="round" />
    <circle cx="50" cy="50" r="5" fill="var(--ink)" />
    <text x="50" y="80" text-anchor="middle" font-size="20" font-weight="800" fill="var(--ink)">{{ done }}</text>
    <text :x="from.x" y="89" text-anchor="middle" font-size="10" font-weight="600" fill="var(--muted)">0</text>
    <text :x="to.x" y="89" text-anchor="middle" font-size="10" font-weight="600" fill="var(--muted)">{{ goal }}</text>
  </svg>
</template>
