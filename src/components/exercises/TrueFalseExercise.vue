<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { Exercise } from "@shared/types";
import ExerciseStem from "./ExerciseStem.vue";
import OptionButton from "./OptionButton.vue";
import type { EvalResult } from "./types";

const props = withDefaults(defineProps<{ exercise: Extract<Exercise, { type: "true-false" }>; checked: boolean; keys?: boolean }>(), { keys: true });
const picked = ref<boolean | null>(null);

function pick(v: boolean) {
  if (!props.checked) picked.value = v;
}
function stateOf(v: boolean) {
  if (!props.checked) return picked.value === v ? "selected" : "idle";
  if (props.exercise.answer === v) return picked.value === v ? "correct" : "missed";
  return picked.value === v ? "wrong" : "idle";
}
function onKey(e: KeyboardEvent) {
  if (!props.keys) return;
  if (e.key === "1") pick(true);
  if (e.key === "2") pick(false);
}
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

const ready = computed(() => picked.value !== null);
function evaluate(): EvalResult {
  const correct = picked.value === props.exercise.answer;
  return { correct, score: correct ? 1 : 0, answer: picked.value, correctAnswer: props.exercise.answer ? "Klopt" : "Klopt niet" };
}
defineExpose({ ready, evaluate });
</script>

<template>
  <div>
    <ExerciseStem :prompt="exercise.prompt" :context="exercise.context" />
    <blockquote class="mb-5 rounded-2xl border-l-4 border-brand bg-surface-2 px-5 py-4 text-xl">{{ exercise.statement }}</blockquote>
    <div class="grid gap-3 sm:grid-cols-2">
      <OptionButton label="Klopt" :hint="keys ? 1 : undefined" :state="stateOf(true)" :disabled="checked" @click="pick(true)" />
      <OptionButton label="Klopt niet" :hint="keys ? 2 : undefined" :state="stateOf(false)" :disabled="checked" @click="pick(false)" />
    </div>
  </div>
</template>
