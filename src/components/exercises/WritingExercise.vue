<script setup lang="ts">
import { computed, ref } from "vue";
import type { Exercise } from "@shared/types";
import { countWords } from "@shared/logic/answers";
import { api } from "../../api/client";
import { useSettingsStore } from "../../stores/settings";
import ExerciseStem from "./ExerciseStem.vue";
import type { EvalResult } from "./types";

const props = defineProps<{ exercise: Extract<Exercise, { type: "writing" }>; checked: boolean }>();
const settings = useSettingsStore();
const text = ref("");
const ticked = ref<boolean[]>(props.exercise.checklist.map(() => false));

const words = computed(() => countWords(text.value));
const ready = computed(() => words.value > 0);
const wordClass = computed(() =>
  words.value === 0 ? "text-muted" : words.value < props.exercise.minWords || words.value > props.exercise.maxWords ? "text-bad" : "text-good",
);

function evaluate(): EvalResult {
  // Saved before anything else happens, so nothing is lost (§10.1).
  api.post("/writing", { exerciseId: props.exercise.id, text: text.value }).catch(() => {});
  return { correct: words.value >= props.exercise.minWords, score: null, answer: text.value };
}
defineExpose({ ready, evaluate });
</script>

<template>
  <div>
    <ExerciseStem :prompt="exercise.prompt" :context="exercise.context" />
    <div class="card mb-4 p-5">
      <p class="font-bold">{{ exercise.task.instructions }}</p>
      <p class="mt-1 text-muted">{{ exercise.task.scenario }}</p>
      <ul class="mt-3 grid gap-1">
        <li v-for="p in exercise.task.requiredPoints" :key="p" class="flex gap-2"><span class="text-brand" aria-hidden="true">●</span>{{ p }}</li>
      </ul>
    </div>
    <label for="writing-text" class="sr-only">Jouw tekst</label>
    <textarea
      id="writing-text"
      v-model="text"
      :disabled="checked"
      :spellcheck="settings.settings?.spellcheckWriting ?? false"
      rows="9"
      class="input text-lg leading-relaxed"
      placeholder="Schrijf hier je tekst…"
    />
    <p class="mt-1 text-sm font-semibold" :class="wordClass" aria-live="polite">{{ words }} woorden (tussen {{ exercise.minWords }} en {{ exercise.maxWords }})</p>

    <div v-if="checked" class="slide-up mt-5 grid gap-4">
      <div class="card p-5">
        <h3 class="mb-2 font-bold">Voorbeeld</h3>
        <p class="whitespace-pre-line text-lg">{{ exercise.modelAnswer }}</p>
      </div>
      <div class="card p-5">
        <h3 class="mb-2 font-bold">Controleer jezelf</h3>
        <label v-for="(item, i) in exercise.checklist" :key="i" class="flex cursor-pointer items-center gap-3 py-1">
          <input v-model="ticked[i]" type="checkbox" class="h-5 w-5 accent-[var(--brand)]" />
          <span :class="{ 'line-through opacity-60': ticked[i] }">{{ item }}</span>
        </label>
      </div>
    </div>
  </div>
</template>
