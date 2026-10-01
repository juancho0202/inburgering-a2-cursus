<script setup lang="ts">
defineProps<{ value: number; label?: string }>();
</script>

<template>
  <div
    class="h-3 w-full overflow-hidden rounded-full bg-surface-2"
    role="progressbar"
    :aria-valuenow="Math.round(value * 100)"
    aria-valuemin="0"
    aria-valuemax="100"
    :aria-label="label"
  >
    <div class="h-full rounded-full bg-brand transition-all duration-300" :style="{ width: `${Math.min(1, Math.max(0, value)) * 100}%` }" />
  </div>
</template>
