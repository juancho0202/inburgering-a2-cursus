<script setup lang="ts">
defineProps<{
  label: string;
  hint?: string | number;
  state: "idle" | "selected" | "correct" | "wrong" | "missed";
  disabled?: boolean;
}>();
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    :aria-pressed="state === 'selected'"
    class="flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3 text-left text-lg font-medium transition active:translate-y-px"
    :class="{
      'border-line bg-surface hover:border-brand hover:bg-brand-bg': state === 'idle',
      'border-brand bg-brand-bg': state === 'selected',
      'border-good bg-good-bg': state === 'correct',
      'border-bad bg-bad-bg': state === 'wrong',
      'border-good border-dashed bg-surface': state === 'missed',
    }"
  >
    <span
      v-if="hint !== undefined"
      class="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-surface-2 text-sm font-bold text-muted"
      aria-hidden="true"
      >{{ hint }}</span
    >
    <span class="flex-1">{{ label }}</span>
    <span v-if="state === 'correct' || state === 'missed'" class="font-bold text-good" aria-label="goed">✓</span>
    <span v-else-if="state === 'wrong'" class="font-bold text-bad" aria-label="fout">✗</span>
  </button>
</template>
