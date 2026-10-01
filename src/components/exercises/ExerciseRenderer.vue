<script setup lang="ts">
import { ref } from "vue";
import type { Exercise } from "@shared/types";
import McExercise from "./McExercise.vue";
import TrueFalseExercise from "./TrueFalseExercise.vue";
import GapFillExercise from "./GapFillExercise.vue";
import WordOrderExercise from "./WordOrderExercise.vue";
import MatchExercise from "./MatchExercise.vue";
import ConjugateExercise from "./ConjugateExercise.vue";
import ReadingExercise from "./ReadingExercise.vue";
import FormFillExercise from "./FormFillExercise.vue";
import WritingExercise from "./WritingExercise.vue";
import type { EvalResult, ExerciseHandle } from "./types";

defineProps<{ exercise: Exercise; checked: boolean }>();

const inner = ref<ExerciseHandle | null>(null);
defineExpose({
  get ready() {
    return inner.value?.ready ?? false;
  },
  evaluate: (): EvalResult => inner.value!.evaluate(),
});

const components = {
  mc: McExercise,
  "mc-multi": McExercise,
  "true-false": TrueFalseExercise,
  "gap-fill": GapFillExercise,
  "gap-choice": GapFillExercise,
  "word-order": WordOrderExercise,
  match: MatchExercise,
  conjugate: ConjugateExercise,
  reading: ReadingExercise,
  "form-fill": FormFillExercise,
  writing: WritingExercise,
} as const;
</script>

<template>
  <component :is="components[exercise.type]" :ref="(el: any) => (inner = el)" :exercise="exercise as any" :checked="checked" />
</template>
