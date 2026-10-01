<script setup lang="ts">
import { computed, ref } from "vue";
import type { Exercise } from "@shared/types";
import { checkWordOrder } from "@shared/logic/answers";
import ExerciseStem from "./ExerciseStem.vue";
import { shuffled, type EvalResult } from "./types";

const props = defineProps<{ exercise: Extract<Exercise, { type: "word-order" }>; checked: boolean }>();

interface Tile {
  id: number;
  text: string;
}
const all: Tile[] = props.exercise.tokens.map((text, id) => ({ id, text }));
function initialPool(): Tile[] {
  let pool = shuffled(all);
  for (let n = 0; n < 5 && pool.length > 1 && pool.every((t, i) => t.id === i); n++) pool = shuffled(all);
  return pool;
}
const pool = ref<Tile[]>(initialPool());
const placed = ref<Tile[]>([]);

function place(t: Tile) {
  if (props.checked) return;
  pool.value = pool.value.filter((x) => x.id !== t.id);
  placed.value = [...placed.value, t];
}
function unplace(t: Tile) {
  if (props.checked) return;
  placed.value = placed.value.filter((x) => x.id !== t.id);
  pool.value = [...pool.value, t];
}

const sentence = computed(() => placed.value.map((t) => t.text));
const isCorrect = computed(() => checkWordOrder(sentence.value, props.exercise.tokens, props.exercise.alsoAccepted));
const ready = computed(() => pool.value.length === 0);

function evaluate(): EvalResult {
  return { correct: isCorrect.value, score: isCorrect.value ? 1 : 0, answer: sentence.value, correctAnswer: props.exercise.tokens.join(" ") };
}
defineExpose({ ready, evaluate });
</script>

<template>
  <div>
    <ExerciseStem :prompt="exercise.prompt" :context="exercise.context" />
    <div
      class="mb-4 flex min-h-20 flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed p-3"
      :class="checked ? (isCorrect ? 'border-good bg-good-bg' : 'border-bad bg-bad-bg') : 'border-line bg-surface'"
      aria-label="Jouw zin"
    >
      <button
        v-for="t in placed"
        :key="t.id"
        type="button"
        :disabled="checked"
        class="rounded-xl border-2 border-brand bg-brand-bg px-3 py-1.5 text-lg font-semibold"
        @click="unplace(t)"
      >
        {{ t.text }}
      </button>
      <span v-if="placed.length === 0" class="text-muted">Tik op de woorden om de zin te maken.</span>
    </div>
    <div class="flex flex-wrap gap-2" aria-label="Woorden">
      <button
        v-for="t in pool"
        :key="t.id"
        type="button"
        :disabled="checked"
        class="rounded-xl border-2 border-line bg-surface px-3 py-1.5 text-lg font-semibold shadow-[0_2px_0_var(--line)] transition hover:border-brand active:translate-y-px"
        @click="place(t)"
      >
        {{ t.text }}
      </button>
    </div>
  </div>
</template>
