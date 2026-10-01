<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { Exercise } from "@shared/types";
import { matchesAny } from "@shared/logic/answers";
import { useVerbsStore } from "../../stores/verbs";
import ExerciseStem from "./ExerciseStem.vue";
import type { EvalResult } from "./types";

const props = defineProps<{ exercise: Extract<Exercise, { type: "conjugate" }>; checked: boolean }>();
const verbs = useVerbsStore();
onMounted(() => verbs.load());

const verb = computed(() => verbs.byId(props.exercise.verbId));
const form = ref("");
const aux = ref<"" | "hebben" | "zijn">("");
const isPerfect = computed(() => props.exercise.tense === "perfect");
const tenseLabel = { present: "tegenwoordige tijd", perfect: "voltooid deelwoord", past: "verleden tijd" } as const;

const formOk = computed(() => matchesAny(form.value, props.exercise.answers));
const auxOk = computed(() => !isPerfect.value || !verb.value || verb.value.auxiliary === "both" || aux.value === verb.value.auxiliary);
const ready = computed(() => form.value.trim() !== "" && (!isPerfect.value || aux.value !== ""));

function evaluate(): EvalResult {
  const correct = formOk.value && auxOk.value;
  const correctAux = verb.value && verb.value.auxiliary !== "both" ? `${verb.value.auxiliary} ` : "";
  return {
    correct,
    score: correct ? 1 : 0,
    answer: { form: form.value, aux: aux.value },
    correctAnswer: isPerfect.value ? `${correctAux}${props.exercise.answers[0]}` : props.exercise.answers[0],
  };
}
defineExpose({ ready, evaluate });
</script>

<template>
  <div>
    <ExerciseStem :prompt="exercise.prompt" :context="exercise.context" />
    <div v-if="verb" class="card p-5">
      <p class="text-muted">Werkwoord: <strong class="text-lg text-ink">{{ verb.infinitive }}</strong> — {{ tenseLabel[exercise.tense] }}</p>
      <div class="mt-3 flex flex-wrap items-center gap-2 text-xl">
        <span class="font-semibold">{{ exercise.person }}</span>
        <select
          v-if="isPerfect"
          v-model="aux"
          :disabled="checked"
          aria-label="hebben of zijn"
          class="rounded-xl border-2 border-line bg-surface px-2 py-1"
          :class="checked && (auxOk ? 'border-good bg-good-bg' : 'border-bad bg-bad-bg')"
        >
          <option value="" disabled>hebben / zijn</option>
          <option value="hebben">heb / hebt / hebben</option>
          <option value="zijn">ben / bent / zijn</option>
        </select>
        <input
          v-model="form"
          :disabled="checked"
          aria-label="Werkwoordsvorm"
          autocomplete="off"
          autocapitalize="off"
          spellcheck="false"
          class="w-48 rounded-xl border-2 px-3 py-1 text-lg"
          :class="checked ? (formOk ? 'border-good bg-good-bg' : 'border-bad bg-bad-bg') : 'border-line bg-surface focus:border-brand'"
        />
      </div>
    </div>
    <p v-else class="text-muted">Even laden…</p>
  </div>
</template>
