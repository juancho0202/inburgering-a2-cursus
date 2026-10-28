<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import type { Exercise } from "@shared/types";
import type { WritingFeedback } from "@shared/schemas/claude";
import { countWords } from "@shared/logic/answers";
import { api, ApiRequestError } from "../../api/client";
import { useSettingsStore } from "../../stores/settings";
import WritingFeedbackPanel from "../WritingFeedbackPanel.vue";
import AppButton from "../ui/AppButton.vue";
import ExerciseStem from "./ExerciseStem.vue";
import UiLabel from "../ui/UiLabel.vue";
import { useLanguageStore } from "../../stores/language";
import type { EvalResult } from "./types";

const props = defineProps<{ exercise: Extract<Exercise, { type: "writing" }>; checked: boolean; prefill?: string }>();
const settings = useSettingsStore();
const lang = useLanguageStore();
const text = ref(props.prefill ?? "");
const ticked = ref<boolean[]>(props.exercise.checklist.map(() => false));

const words = computed(() => countWords(text.value));
const ready = computed(() => words.value > 0);
const wordClass = computed(() =>
  words.value === 0 ? "text-muted" : words.value < props.exercise.minWords || words.value > props.exercise.maxWords ? "text-bad" : "text-good",
);

// The text is saved first; Claude feedback (if there is a key) comes after.
let saving: Promise<{ id: string } | null> = Promise.resolve(null);
const feedback = ref<WritingFeedback | null>(null);
const status = ref<"idle" | "loading" | "error">("idle");
const error = ref<string | null>(null);
let submissionId: string | undefined;

function evaluate(): EvalResult {
  saving = api
    .post<{ id: string }>("/writing", { exerciseId: props.exercise.id, text: text.value })
    .then((s) => {
      submissionId = s.id;
      return s;
    })
    .catch(() => null);
  return { correct: words.value >= props.exercise.minWords, score: null, answer: text.value };
}

async function askClaude() {
  status.value = "loading";
  error.value = null;
  await saving;
  try {
    const res = await api.post<{ feedback: WritingFeedback }>("/claude/feedback-writing", {
      exerciseId: props.exercise.id,
      text: text.value,
      submissionId,
    });
    feedback.value = res.feedback;
    status.value = "idle";
  } catch (e) {
    if (e instanceof ApiRequestError && typeof e.body.submissionId === "string") submissionId = e.body.submissionId;
    error.value = (e as Error).message;
    status.value = "error";
  }
}

watch(
  () => props.checked,
  (c) => {
    if (c && settings.hasKey) askClaude();
  },
);
defineExpose({ ready, evaluate });
</script>

<template>
  <div>
    <ExerciseStem :prompt="exercise.prompt" :context="exercise.context" />
    <div class="card mb-4 p-5">
      <p class="font-bold">{{ exercise.task.instructions }}</p>
      <p class="mt-1 text-muted">{{ exercise.task.scenario }}</p>
      <ul class="mt-3 grid gap-1">
        <li v-for="p in exercise.task.requiredPoints" :key="p" class="flex gap-2"><span class="text-brand" aria-hidden="true">●</span>{{ p }}</li>
      </ul>
    </div>
    <label for="writing-text" class="sr-only">{{ lang.t("exercise.yourText") }}</label>
    <textarea
      id="writing-text"
      v-model="text"
      :disabled="checked"
      :spellcheck="settings.settings?.spellcheckWriting ?? false"
      rows="9"
      class="input text-lg leading-relaxed"
      :placeholder="lang.t('exercise.writeHere')"
    />
    <p class="mt-1 text-sm font-semibold" :class="wordClass" aria-live="polite">{{ lang.t("exercise.wordCount", { n: words, min: exercise.minWords, max: exercise.maxWords }) }}</p>

    <div v-if="checked" class="slide-up mt-5 grid gap-4">
      <!-- Claude feedback -->
      <div v-if="settings.hasKey" aria-live="polite">
        <div v-if="status === 'loading'" class="card flex items-center gap-3 p-5">
          <span class="h-5 w-5 animate-spin rounded-full border-4 border-line border-t-brand" aria-hidden="true" />
          <p class="font-semibold">{{ lang.feedback("exercise.claudeReading") }}</p>
        </div>
        <div v-else-if="status === 'error'" class="card border-bad p-5">
          <p class="font-bold text-bad">✗ {{ error }}</p>
          <p class="mt-1 text-muted">{{ lang.feedback("exercise.savedCheckBelow") }}</p>
          <AppButton class="mt-3" variant="secondary" @click="askClaude"><UiLabel k="exercise.retryFeedback" /></AppButton>
        </div>
        <WritingFeedbackPanel v-else-if="feedback" :text="text" :feedback="feedback" />
      </div>
      <div v-else class="card p-5">
        <p class="font-bold">{{ lang.feedback("exercise.noFeedback") }}</p>
        <p class="text-muted">
          {{ lang.feedback("exercise.addKeyFor") }} <RouterLink to="/instellingen" class="font-semibold text-brand-strong underline"><UiLabel k="nav.settings" /></RouterLink>. {{ lang.feedback("exercise.savedCheckYourself") }}
        </p>
      </div>

      <!-- Self-check (always available) -->
      <div class="card p-5">
        <h3 class="mb-2 font-bold"><UiLabel k="exercise.example" /></h3>
        <p class="whitespace-pre-line text-lg">{{ exercise.modelAnswer }}</p>
      </div>
      <div class="card p-5">
        <h3 class="mb-2 font-bold"><UiLabel k="exercise.checkYourself" /></h3>
        <label v-for="(item, i) in exercise.checklist" :key="i" class="flex cursor-pointer items-center gap-3 py-1">
          <input v-model="ticked[i]" type="checkbox" class="h-5 w-5 accent-[var(--brand)]" />
          <span :class="{ 'line-through opacity-60': ticked[i] }">{{ item }}</span>
        </label>
        <!-- Part of the course (the exam's own checklist), so Dutch -->
        <p class="mt-4 border-t border-line pt-3 text-sm text-muted" lang="nl" translate="no">
          <strong>Examenchecklist:</strong> 1. Alle punten beantwoord? 2. Aanhef en afsluiting goed? 3. u of je? 4. Werkwoord op plek 2; in een bijzin aan het eind? 5. Hoofdletter en punt? 6. Genoeg woorden? 7. Duidelijk geschreven?
        </p>
      </div>
    </div>
  </div>
</template>
