<script setup lang="ts">
/** Play/stop for reading the current step aloud. Same brand colour as the highlight on the part being read. */
defineProps<{ reading: boolean; label: string }>();
defineEmits<{ toggle: [] }>();
</script>

<template>
  <button
    type="button"
    class="inline-flex items-center gap-2 rounded-full border-2 px-3 py-1 text-sm font-bold transition"
    :class="reading ? 'border-brand bg-brand text-white dark:text-black' : 'border-brand/40 bg-brand-bg text-brand-strong hover:border-brand'"
    :aria-pressed="reading"
    @click="$emit('toggle')"
  >
    <span v-if="reading" class="sound-bars" aria-hidden="true"><i /><i /><i /></span>
    <span v-else aria-hidden="true">▶</span>
    {{ reading ? "Stop" : label }}
  </button>
</template>
