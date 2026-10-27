<script setup lang="ts">
import { onMounted, ref } from "vue";

/**
 * An image without a blank flash: one that is already downloaded (cached or warmed, see warmImages) shows at once;
 * one that still has to load fades in when it is ready.
 */
defineProps<{ src: string; alt: string }>();
const img = ref<HTMLImageElement | null>(null);
const shown = ref(false);
const fade = ref(false);

onMounted(() => {
  if (img.value?.complete && img.value.naturalWidth > 0) shown.value = true;
  else fade.value = true;
});
</script>

<template>
  <img
    ref="img"
    :src="src"
    :alt="alt"
    decoding="sync"
    :class="[shown ? 'opacity-100' : 'opacity-0', fade && 'transition-opacity duration-200']"
    @load="shown = true"
  />
</template>
