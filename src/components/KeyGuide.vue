<script setup lang="ts">
import UiLabel from "./ui/UiLabel.vue";
import UiText from "./ui/UiText.vue";
</script>

<template>
  <details class="rounded-2xl border border-line p-4">
    <summary class="cursor-pointer font-bold"><UiLabel variant="heading" k="keyGuide.title" /></summary>
    <ol class="mt-3 grid list-decimal gap-1 pl-5">
      <li v-for="n in 5" :key="n"><UiText :k="`keyGuide.step${n}`" md /></li>
    </ol>
  </details>
</template>
