<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { Exercise } from "@shared/types";
import ExerciseStem from "./ExerciseStem.vue";
import OptionButton from "./OptionButton.vue";
import { shuffled, type EvalResult } from "./types";

type Mc = Extract<Exercise, { type: "mc" | "mc-multi" }>;
const props = withDefaults(
  defineProps<{ exercise: Mc; checked: boolean; keys?: boolean; hideStem?: boolean; initial?: number[]; shuffle?: boolean }>(),
  { keys: true, shuffle: true },
);
// Used by exam mode: keep the selection outside the component and keep the option order stable.
const emit = defineEmits<{ change: [selected: number[]] }>();

const multi = computed(() => props.exercise.type === "mc-multi");
const correctSet = computed(() => new Set(props.exercise.type === "mc-multi" ? props.exercise.answers : [props.exercise.answer]));
const identity = props.exercise.options.map((_, i) => i);
const order = ref(props.shuffle ? shuffled(identity) : identity);
const selected = ref<number[]>([...(props.initial ?? [])]);
watch(selected, (v) => emit("change", [...v]));

function toggle(orig: number) {
  if (props.checked) return;
  if (multi.value) selected.value = selected.value.includes(orig) ? selected.value.filter((i) => i !== orig) : [...selected.value, orig];
  else selected.value = [orig];
}

function stateOf(orig: number) {
  const sel = selected.value.includes(orig);
  if (!props.checked) return sel ? "selected" : "idle";
  if (correctSet.value.has(orig)) return sel ? "correct" : "missed";
  return sel ? "wrong" : "idle";
}

function onKey(e: KeyboardEvent) {
  if (!props.keys || props.checked) return;
  const n = Number(e.key);
  if (n >= 1 && n <= order.value.length && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) toggle(order.value[n - 1]);
}
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));

const ready = computed(() => selected.value.length > 0);

function evaluate(): EvalResult {
  const sel = [...selected.value].sort();
  const want = [...correctSet.value].sort();
  const correct = sel.length === want.length && sel.every((v, i) => v === want[i]);
  return {
    correct,
    score: correct ? 1 : 0,
    answer: multi.value ? sel : sel[0],
    correctAnswer: want.map((i) => props.exercise.options[i]).join(" + "),
  };
}
defineExpose({ ready, evaluate });
</script>

<template>
  <div>
    <ExerciseStem v-if="!hideStem" :prompt="exercise.prompt" :context="exercise.context" />
    <p v-if="multi" class="-mt-3 mb-3 text-muted">Kies alle goede antwoorden.</p>
    <div class="grid gap-3" role="group" :aria-label="exercise.prompt">
      <OptionButton
        v-for="(orig, pos) in order"
        :key="orig"
        :label="exercise.options[orig]"
        :hint="keys ? pos + 1 : undefined"
        :state="stateOf(orig)"
        :disabled="checked"
        @click="toggle(orig)"
      />
    </div>
  </div>
</template>
