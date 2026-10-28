<script setup lang="ts">
import { computed, provide, ref } from "vue";
import type { Exercise } from "@shared/types";
import FragmentPlayer from "../FragmentPlayer.vue";
import SpeakButton from "../ui/SpeakButton.vue";
import McExercise from "./McExercise.vue";
import { listenKey, type EvalResult, type ExerciseHandle } from "./types";
import { spotKey } from "../../lib/illustrations";
import UiLabel from "../ui/UiLabel.vue";

const props = defineProps<{ exercise: Extract<Exercise, { type: "listening" }>; checked: boolean }>();

const player = ref<InstanceType<typeof FragmentPlayer> | null>(null);
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

// After checking, the text shows where each answer is said ("Vraag 1", or "Vraag 1 en 2" on one line).
const marks = computed(() => {
  const byLine: Record<number, number[]> = {};
  props.exercise.questions.forEach((q, i) => q.answerLine !== undefined && (byLine[q.answerLine] ??= []).push(i + 1));
  return Object.fromEntries(Object.entries(byLine).map(([l, qs]) => [l, `Vraag ${qs.join(" en ")}`]));
});

// The fragment is the picture here: no drawings next to the questions, and nothing extra to hear.
provide(spotKey, null);
provide(listenKey, null);
</script>

<template>
  <div class="grid gap-6 lg:grid-cols-2 lg:items-start">
    <div class="lg:sticky lg:top-20">
      <h2 class="mb-3 text-2xl font-bold">{{ exercise.prompt }}</h2>
      <FragmentPlayer ref="player" :fragment="exercise.fragment" :show-text="checked" :marks="checked ? marks : undefined" />
    </div>
    <div class="grid gap-6">
      <section v-for="(q, i) in exercise.questions" :key="q.id" class="card p-5">
        <p class="mb-2 flex items-center justify-between gap-2 text-sm font-bold uppercase tracking-wide text-muted">
          Vraag {{ i + 1 }}
          <SpeakButton :text="q.prompt" />
        </p>
        <McExercise v-if="q.type === 'mc'" :ref="(el: any) => (children[i] = el)" :exercise="q" :checked="checked" :keys="false" />
        <p v-if="checked" class="mt-3 text-muted">{{ q.explanation }}</p>
        <button
          v-if="checked && q.answerLine !== undefined"
          type="button"
          class="mt-3 inline-flex items-center gap-2 rounded-full border-2 border-good/50 bg-good-bg px-3 py-1 text-sm font-bold text-good hover:border-good"
          @click="player?.playFrom(q.answerLine)"
        >
          ▶ <UiLabel k="exercise.listenAnswer" />
        </button>
      </section>
    </div>
  </div>
</template>
