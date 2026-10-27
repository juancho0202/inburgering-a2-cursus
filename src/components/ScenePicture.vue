<script setup lang="ts">
import { computed } from "vue";
import { scene } from "../lib/illustrations";

/** An illustration from src/assets/scenes. Like a printed picture in a book, it stays light in dark mode (a little dimmer). */
const props = defineProps<{ id: string; caption?: string }>();
const picture = computed(() => scene(props.id));
</script>

<template>
  <figure v-if="picture">
    <img
      :src="picture.url"
      :alt="picture.alt"
      width="480"
      height="320"
      loading="lazy"
      decoding="async"
      class="aspect-[3/2] w-full rounded-2xl border border-line bg-[#fff8ee] shadow-card dark:brightness-90"
    />
    <figcaption v-if="caption" class="mt-2 text-center text-muted">{{ caption }}</figcaption>
  </figure>
</template>
