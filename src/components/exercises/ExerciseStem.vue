<script setup lang="ts">
import { inject, ref } from "vue";
import { renderMdInline } from "../../composables/markdown";
import { useSpeech } from "../../composables/useSpeech";
import { spotKey } from "../../lib/illustrations";
import { listenKey } from "./types";
defineProps<{ prompt: string; context?: string }>();
// A little drawing beside the question, like in the margin of a language book (decorative).
const spot = inject(spotKey, null);
// A listening task: the text is played, not shown. Who cannot listen now (no sound, hard of hearing) can still read it.
const listen = inject(listenKey, null);
const { speak } = useSpeech();
const showText = ref(false);
</script>

<template>
  <div class="mb-5 flex items-start gap-4">
    <div class="min-w-0 flex-1">
      <p v-if="context" class="mb-3 rounded-2xl bg-surface-2 px-4 py-3 text-muted" v-html="renderMdInline(context)" />
      <h2 class="text-2xl font-bold leading-snug" v-html="renderMdInline(prompt)" />
      <div v-if="listen" class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-lg font-bold text-white shadow-card hover:brightness-110 dark:text-black"
          @click="speak(listen)"
        >
          <span aria-hidden="true">🔊</span> Luister
        </button>
        <button v-if="!showText" type="button" class="text-sm text-muted underline" @click="showText = true">Ik kan nu niet luisteren</button>
        <p v-else class="rounded-xl bg-surface-2 px-3 py-1.5 text-lg">“{{ listen }}”</p>
      </div>
    </div>
    <img
      v-if="spot"
      :src="spot.url"
      alt=""
      aria-hidden="true"
      width="200"
      height="220"
      decoding="async"
      class="w-20 shrink-0 rounded-2xl bg-[#fff8ee] p-1 sm:w-28 dark:brightness-90"
      :class="{ 'sm:order-first': spot.side === 'left' }"
    />
  </div>
</template>
