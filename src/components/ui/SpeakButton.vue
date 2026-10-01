<script setup lang="ts">
import { useSpeech } from "../../composables/useSpeech";

const props = defineProps<{ text: string }>();
const { available, speak } = useSpeech();
</script>

<template>
  <button
    v-if="available"
    type="button"
    class="inline-grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-bg text-base hover:brightness-95"
    :aria-label="`Luister: ${props.text}`"
    @click.stop="speak(props.text)"
  >
    🔊
  </button>
</template>
