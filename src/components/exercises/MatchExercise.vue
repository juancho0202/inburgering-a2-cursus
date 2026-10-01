<script setup lang="ts">
import { computed, ref } from "vue";
import type { Exercise } from "@shared/types";
import ExerciseStem from "./ExerciseStem.vue";
import { shuffled, type EvalResult } from "./types";

const props = defineProps<{ exercise: Extract<Exercise, { type: "match" }>; checked: boolean }>();

const rightOrder = ref(shuffled(props.exercise.pairs.map((_, i) => i)));
/** left index -> right (original) index */
const links = ref<Record<number, number>>({});
const activeLeft = ref<number | null>(null);

const linkNumber = (left: number) => Object.keys(links.value).map(Number).sort((a, b) => a - b).indexOf(left) + 1;
const rightLinkedTo = (right: number) => Object.entries(links.value).find(([, r]) => r === right)?.[0];

function clickLeft(i: number) {
  if (props.checked) return;
  if (i in links.value) {
    const { [i]: _drop, ...rest } = links.value;
    links.value = rest;
    activeLeft.value = i;
  } else activeLeft.value = activeLeft.value === i ? null : i;
}
function clickRight(r: number) {
  if (props.checked || activeLeft.value === null) return;
  const next = { ...links.value };
  const other = rightLinkedTo(r);
  if (other !== undefined) delete next[Number(other)];
  next[activeLeft.value] = r;
  links.value = next;
  activeLeft.value = null;
}

const ready = computed(() => Object.keys(links.value).length === props.exercise.pairs.length);
const ok = (left: number) => links.value[left] === left;

function evaluate(): EvalResult {
  const correct = props.exercise.pairs.every((_, i) => ok(i));
  return {
    correct,
    score: correct ? 1 : 0,
    answer: links.value,
    correctAnswer: props.exercise.pairs.map(([l, r]) => `${l} = ${r}`).join("; "),
  };
}
defineExpose({ ready, evaluate });
</script>

<template>
  <div>
    <ExerciseStem :prompt="exercise.prompt" :context="exercise.context" />
    <p class="-mt-3 mb-3 text-muted">Kies links een woord en dan rechts het passende woord.</p>
    <div class="grid grid-cols-2 gap-x-6 gap-y-3">
      <div class="grid content-start gap-3">
        <button
          v-for="(pair, i) in exercise.pairs"
          :key="i"
          type="button"
          :disabled="checked"
          class="flex items-center gap-2 rounded-2xl border-2 px-3 py-3 text-left font-medium transition"
          :class="
            checked
              ? ok(i)
                ? 'border-good bg-good-bg'
                : 'border-bad bg-bad-bg'
              : activeLeft === i
                ? 'border-brand bg-brand-bg'
                : i in links
                  ? 'border-brand/60 bg-surface'
                  : 'border-line bg-surface hover:border-brand'
          "
          @click="clickLeft(i)"
        >
          <span v-if="i in links" class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white">{{ linkNumber(i) }}</span>
          <span class="flex-1">{{ pair[0] }}</span>
          <span v-if="checked" :class="ok(i) ? 'text-good' : 'text-bad'" aria-hidden="true">{{ ok(i) ? "✓" : "✗" }}</span>
        </button>
      </div>
      <div class="grid content-start gap-3">
        <button
          v-for="r in rightOrder"
          :key="r"
          type="button"
          :disabled="checked"
          class="flex items-center gap-2 rounded-2xl border-2 px-3 py-3 text-left font-medium transition"
          :class="rightLinkedTo(r) !== undefined ? 'border-brand/60 bg-surface' : 'border-line bg-surface hover:border-brand'"
          @click="clickRight(r)"
        >
          <span
            v-if="rightLinkedTo(r) !== undefined"
            class="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand text-sm font-bold text-white"
            >{{ linkNumber(Number(rightLinkedTo(r))) }}</span
          >
          <span>{{ exercise.pairs[r][1] }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
