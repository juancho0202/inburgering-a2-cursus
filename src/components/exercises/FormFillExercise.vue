<script setup lang="ts">
import { computed, ref } from "vue";
import type { Exercise } from "@shared/types";
import { matchesAny } from "@shared/logic/answers";
import ExerciseStem from "./ExerciseStem.vue";
import type { EvalResult } from "./types";

const props = defineProps<{ exercise: Extract<Exercise, { type: "form-fill" }>; checked: boolean }>();
const values = ref<string[]>(props.exercise.fields.map(() => ""));

const graded = computed(() => props.exercise.fields.map((f, i) => ({ f, i })).filter(({ f }) => f.expected !== undefined));
const fieldOk = (i: number) => matchesAny(values.value[i], [props.exercise.fields[i].expected ?? ""]);
const ready = computed(() => values.value.some((v) => v.trim() !== ""));

function evaluate(): EvalResult {
  const good = graded.value.filter(({ i }) => fieldOk(i)).length;
  const total = graded.value.length;
  return {
    correct: good === total,
    score: total > 0 ? good / total : null,
    answer: [...values.value],
    correctAnswer: graded.value.map(({ f }) => `${f.label}: ${f.expected}`).join("; "),
  };
}
defineExpose({ ready, evaluate });

const state = (i: number) => (!props.checked || props.exercise.fields[i].expected === undefined ? "" : fieldOk(i) ? "ok" : "bad");
</script>

<template>
  <div>
    <ExerciseStem :prompt="exercise.prompt" :context="exercise.context" />
    <p class="mb-4 rounded-2xl bg-surface-2 px-4 py-3"><strong>Situatie:</strong> {{ exercise.scenario }}</p>
    <form class="card overflow-hidden" @submit.prevent>
      <h3 class="border-b border-line bg-surface-2 px-5 py-3 text-lg font-bold">{{ exercise.formTitle }}</h3>
      <div class="grid gap-4 p-5 sm:grid-cols-2">
        <label v-for="(field, i) in exercise.fields" :key="i" class="block">
          <span class="text-sm font-bold text-muted">{{ field.label }}</span>
          <input
            v-model="values[i]"
            :disabled="checked"
            autocomplete="off"
            spellcheck="false"
            :placeholder="field.hint"
            class="input mt-1"
            :class="{ 'border-good bg-good-bg': state(i) === 'ok', 'border-bad bg-bad-bg': state(i) === 'bad' }"
          />
          <span v-if="state(i) === 'bad'" class="text-sm text-bad">Goed antwoord: {{ field.expected }}</span>
        </label>
      </div>
    </form>
  </div>
</template>
