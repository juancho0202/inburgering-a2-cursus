<script setup lang="ts">
import { computed, ref } from "vue";
import type { Exercise } from "@shared/types";
import { matchesAny } from "@shared/logic/answers";
import ExerciseStem from "./ExerciseStem.vue";
import type { EvalResult } from "./types";

const props = defineProps<{ exercise: Extract<Exercise, { type: "gap-fill" | "gap-choice" }>; checked: boolean }>();

const parts = computed(() => props.exercise.text.split("___"));
const gapCount = computed(() => parts.value.length - 1);
const values = ref<string[]>(Array(gapCount.value).fill(""));
const isChoice = computed(() => props.exercise.type === "gap-choice");

function gapOk(i: number): boolean {
  const ex = props.exercise;
  if (ex.type === "gap-choice") return values.value[i] === ex.options[i][ex.answers[i]];
  return matchesAny(values.value[i], ex.answers[i] ?? []);
}
const ready = computed(() => values.value.every((v) => v.trim() !== ""));

function evaluate(): EvalResult {
  const ex = props.exercise;
  const oks = values.value.map((_, i) => gapOk(i));
  const correct = oks.every(Boolean);
  const correctAnswer = ex.type === "gap-choice" ? ex.answers.map((a, i) => ex.options[i][a]).join(", ") : ex.answers.map((a) => a[0]).join(", ");
  return { correct, score: oks.every(Boolean) ? 1 : 0, answer: [...values.value], correctAnswer };
}
defineExpose({ ready, evaluate });

const boxClass = (i: number) =>
  props.checked ? (gapOk(i) ? "border-good bg-good-bg" : "border-bad bg-bad-bg") : "border-line bg-surface focus:border-brand";
</script>

<template>
  <div>
    <ExerciseStem :prompt="exercise.prompt" :context="exercise.context" />
    <p class="text-xl leading-[2.6]">
      <template v-for="(part, i) in parts" :key="i">
        <span>{{ part }}</span>
        <template v-if="i < gapCount">
          <select
            v-if="isChoice"
            v-model="values[i]"
            :disabled="checked"
            :aria-label="`Invulplek ${i + 1}`"
            class="mx-1 rounded-xl border-2 px-2 py-1 text-lg"
            :class="boxClass(i)"
          >
            <option value="" disabled>…</option>
            <option v-for="opt in (exercise as any).options[i]" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <input
            v-else
            v-model="values[i]"
            :disabled="checked"
            :aria-label="`Invulplek ${i + 1}`"
            autocomplete="off"
            autocapitalize="off"
            spellcheck="false"
            class="mx-1 w-36 rounded-xl border-2 px-2 py-1 text-center text-lg"
            :class="boxClass(i)"
          />
          <span v-if="checked" class="font-bold" :class="gapOk(i) ? 'text-good' : 'text-bad'" aria-hidden="true">{{ gapOk(i) ? "✓" : "✗" }}</span>
        </template>
      </template>
    </p>
  </div>
</template>
