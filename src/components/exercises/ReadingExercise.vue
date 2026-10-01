<script setup lang="ts">
import { computed, ref } from "vue";
import type { Exercise } from "@shared/types";
import DocumentCard from "../DocumentCard.vue";
import McExercise from "./McExercise.vue";
import TrueFalseExercise from "./TrueFalseExercise.vue";
import GapFillExercise from "./GapFillExercise.vue";
import type { EvalResult, ExerciseHandle } from "./types";

const props = defineProps<{ exercise: Extract<Exercise, { type: "reading" }>; checked: boolean }>();

const questionComponent = (q: Exercise) =>
  q.type === "mc" || q.type === "mc-multi" ? McExercise : q.type === "true-false" ? TrueFalseExercise : GapFillExercise;

const children = ref<(ExerciseHandle | null)[]>([]);
const ready = computed(() => props.exercise.questions.every((_, i) => children.value[i]?.ready));

function evaluate(): EvalResult {
  const parts = props.exercise.questions.map((q, i) => {
    const r = children.value[i]!.evaluate();
    return { itemId: q.id, correct: r.correct, answer: r.answer };
  });
  const good = parts.filter((p) => p.correct).length;
  return {
    correct: good === parts.length,
    score: good / Math.max(1, parts.length),
    answer: parts.map((p) => p.answer),
    correctAnswer: good === parts.length ? undefined : `${good} van ${parts.length} goed`,
    parts,
  };
}
defineExpose({ ready, evaluate });
</script>

<template>
  <div v-if="exercise.document.kind === 'document'" class="grid gap-6 lg:grid-cols-2 lg:items-start">
    <div class="lg:sticky lg:top-20">
      <h2 class="mb-3 text-2xl font-bold">{{ exercise.prompt }}</h2>
      <DocumentCard :doc="exercise.document" />
    </div>
    <div class="grid gap-6">
      <section v-for="(q, i) in exercise.questions" :key="q.id" class="card p-5">
        <p class="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Vraag {{ i + 1 }}</p>
        <component
          :is="questionComponent(q)"
          :ref="(el: any) => (children[i] = el)"
          :exercise="q as any"
          :checked="checked"
          :keys="false"
        />
      </section>
    </div>
  </div>
</template>
