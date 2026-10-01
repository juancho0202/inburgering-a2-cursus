<script setup lang="ts">
import { renderMdInline } from "../../composables/markdown";
defineProps<{ prompt: string; context?: string }>();
</script>

<template>
  <div class="mb-5">
    <p v-if="context" class="mb-3 rounded-2xl bg-surface-2 px-4 py-3 text-muted" v-html="renderMdInline(context)" />
    <h2 class="text-2xl font-bold leading-snug" v-html="renderMdInline(prompt)" />
  </div>
</template>
