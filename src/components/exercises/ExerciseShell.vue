<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, provide, ref } from "vue";
import { RouterLink } from "vue-router";
import type { Exercise } from "@shared/types";
import type { Explanation } from "@shared/schemas/claude";
import { api } from "../../api/client";
import { useSettingsStore } from "../../stores/settings";
import { useSounds } from "../../composables/useSounds";
import { stopSpeech } from "../../composables/useSpeech";
import AppButton from "../ui/AppButton.vue";
import ReportIssue from "../ReportIssue.vue";
import FeedbackLanguageToggle from "../FeedbackLanguageToggle.vue";
import UiLabel from "../ui/UiLabel.vue";
import UiText from "../ui/UiText.vue";
import { useLanguageStore } from "../../stores/language";
import ExerciseRenderer from "./ExerciseRenderer.vue";
import { spotFor, spotKey } from "../../lib/illustrations";
import { listenKey, type EvalResult } from "./types";

const props = defineProps<{ exercise: Exercise; isLast?: boolean }>();
const emit = defineEmits<{ done: [result: EvalResult]; exit: [] }>();

provide(spotKey, spotFor(props.exercise));
provide(listenKey, props.exercise.listen ?? null);

const settings = useSettingsStore();
const lang = useLanguageStore();
const sounds = useSounds();
const renderer = ref<InstanceType<typeof ExerciseRenderer> | null>(null);
const result = ref<EvalResult | null>(null);
const saveError = ref<string | null>(null);
const startedAt = Date.now();
const checked = computed(() => result.value !== null);
const ready = computed(() => renderer.value?.ready ?? false);

const isGenerated = computed(() => props.exercise.id.startsWith("gen-"));
const isWriting = computed(() => props.exercise.type === "writing");
const flagged = ref(false);

// "Opnieuw proberen" for writing: the old submission stays in the history.
const renderKey = ref(0);
const prefill = ref<string | undefined>(undefined);

// Picked once per check, so switching the feedback language translates the same praise instead of picking another.
const praise = ref(0);
const headline = computed(() => {
  const r = result.value;
  if (!r) return "";
  if (r.score === null) return lang.feedback("feedback.compare");
  if (r.correct) return lang.feedback(`feedback.praise${praise.value}`);
  return lang.feedback(r.correctAnswer ? "feedback.almost" : "feedback.notQuite");
});

async function check() {
  if (checked.value || !ready.value || !renderer.value) return;
  const r = renderer.value.evaluate();
  praise.value = Math.floor(Math.random() * 3);
  result.value = r;
  stopSpeech();
  if (r.score !== null) (r.correct ? sounds.correct : sounds.wrong)();
  const durationMs = Date.now() - startedAt;
  const items = r.parts ?? [{ itemId: props.exercise.id, correct: r.correct, answer: r.answer }];
  try {
    // Every answer is saved immediately.
    await Promise.all(
      items.map((p) =>
        api.post("/attempts", {
          itemId: p.itemId,
          exerciseType: props.exercise.type,
          correct: p.correct,
          answer: p.answer ?? null,
          durationMs: Math.round(durationMs / items.length),
        }),
      ),
    );
  } catch (err) {
    saveError.value = (err as Error).message;
  }
}

function next() {
  if (result.value) emit("done", result.value);
}

function retry() {
  prefill.value = typeof result.value?.answer === "string" ? result.value.answer : undefined;
  result.value = null;
  explanations.value = {};
  renderKey.value++;
}

// ----- "Leg uit" (Claude explains a mistake) -----
type ExplainState = { loading: boolean; error?: string; data?: Explanation };
const explanations = ref<Record<string, ExplainState>>({});
const wrongItems = computed(() => {
  const r = result.value;
  if (!r || r.correct || r.score === null) return [];
  const label = (n?: number) => (n === undefined ? { k: "feedback.explain" } : { k: "feedback.explainQuestion", params: { n } });
  if (r.parts) return r.parts.filter((p) => !p.correct).map((p) => ({ ...p, label: label(r.parts!.length > 1 ? r.parts!.indexOf(p) + 1 : undefined) }));
  return [{ itemId: props.exercise.id, answer: r.answer, correct: false, label: label() }];
});

async function explain(item: { itemId: string; answer: unknown }) {
  explanations.value = { ...explanations.value, [item.itemId]: { loading: true } };
  try {
    const data = await api.post<Explanation>("/claude/explain", { itemId: item.itemId, learnerAnswer: item.answer ?? null });
    explanations.value = { ...explanations.value, [item.itemId]: { loading: false, data } };
  } catch (e) {
    explanations.value = { ...explanations.value, [item.itemId]: { loading: false, error: (e as Error).message } };
  }
}

// ----- generated exercises -----
async function flag() {
  await api.post(`/generated/${props.exercise.id}/flag`).catch(() => {});
  flagged.value = true;
  emit("done", { correct: true, score: null, answer: null });
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") return emit("exit");
  if (e.key !== "Enter" || e.target instanceof HTMLTextAreaElement) return;
  e.preventDefault();
  if (checked.value) next();
  else check();
}
onMounted(() => window.addEventListener("keydown", onKey, true));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="pb-44">
    <p v-if="isGenerated" class="mb-3 flex items-center gap-2">
      <span class="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-bold text-violet-700 dark:bg-violet-950 dark:text-violet-300">Claude</span>
      <span class="text-sm text-muted"><UiText k="feedback.byClaude" /></span>
    </p>
    <ExerciseRenderer ref="renderer" :key="renderKey" :exercise="exercise" :checked="checked" :prefill="prefill" />
    <div class="mt-10 flex justify-center"><ReportIssue :item-id="exercise.id" /></div>

    <div class="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur" role="region" :aria-label="lang.t('feedback.region')">
      <div v-if="result" role="status" aria-live="polite" class="slide-up max-h-[45vh] overflow-y-auto border-b border-line" :class="result.score === null ? 'bg-surface-2' : result.correct ? 'bg-good-bg' : 'bg-bad-bg'">
        <div class="mx-auto max-w-4xl px-4 py-3">
          <div class="flex flex-wrap items-start justify-between gap-2">
            <p class="flex flex-wrap items-baseline gap-x-2 text-lg font-bold" :class="result.score === null ? '' : result.correct ? 'text-good' : 'text-bad'">
              <span aria-hidden="true">{{ result.score === null ? "📝" : result.correct ? "✓" : "✗" }}</span>
              <span :lang="lang.feedbackOwn ? lang.locale : 'nl'">{{ headline }}</span>
              <span v-if="!result.correct && result.correctAnswer && result.score !== null" class="text-ink" lang="nl" translate="no">{{ result.correctAnswer }}</span>
            </p>
            <FeedbackLanguageToggle v-if="!lang.dutchOnly" />
          </div>
          <!-- The explanation is course content: Dutch, also when the feedback is in the learner's language -->
          <p v-if="exercise.explanation" class="mt-1" lang="nl" translate="no">{{ exercise.explanation }}</p>
          <p v-if="saveError" class="mt-1 text-sm text-bad">{{ saveError }}</p>

          <template v-if="wrongItems.length">
            <div v-if="settings.hasKey" class="mt-2 flex flex-wrap gap-2">
              <AppButton
                v-for="w in wrongItems"
                :key="w.itemId"
                variant="secondary"
                :disabled="explanations[w.itemId]?.loading"
                @click="explain(w)"
              >
                🤖 <UiLabel :k="w.label.k" :params="w.label.params" />
              </AppButton>
            </div>
            <p v-else class="mt-1 text-sm text-muted">{{ lang.feedback("feedback.wantClaude") }} <RouterLink to="/instellingen" class="font-semibold underline"><UiLabel variant="inline" k="nav.settings" /></RouterLink>.</p>
            <template v-for="w in wrongItems" :key="'e' + w.itemId">
              <p v-if="explanations[w.itemId]?.loading" class="mt-2 font-semibold">{{ lang.feedback("feedback.thinking") }}</p>
              <p v-else-if="explanations[w.itemId]?.error" class="mt-2 font-semibold text-bad">✗ {{ explanations[w.itemId]?.error }}</p>
              <div v-else-if="explanations[w.itemId]?.data" class="mt-2 rounded-2xl bg-surface p-3" lang="nl">
                <p>{{ explanations[w.itemId]!.data!.explanation }}</p>
                <p v-if="explanations[w.itemId]!.data!.rule" class="mt-1 font-semibold"><span :lang="lang.feedbackOwn ? lang.locale : 'nl'">{{ lang.feedback("feedback.rule") }}</span> {{ explanations[w.itemId]!.data!.rule }}</p>
                <ul class="mt-1 list-disc pl-5 italic"><li v-for="ex in explanations[w.itemId]!.data!.extraExamples" :key="ex">{{ ex }}</li></ul>
              </div>
            </template>
          </template>
        </div>
      </div>
      <div class="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div class="flex gap-1">
          <AppButton variant="ghost" @click="emit('exit')"><UiLabel k="common.stop" /></AppButton>
          <AppButton v-if="isGenerated && !flagged" variant="ghost" @click="flag"><UiLabel k="feedback.wrongExercise" /></AppButton>
        </div>
        <div class="flex gap-2">
          <AppButton v-if="isWriting && checked" variant="secondary" size="lg" @click="retry"><UiLabel k="common.tryAgain" /></AppButton>
          <AppButton v-if="!checked" size="lg" :disabled="!ready" @click="check"><UiLabel k="common.check" /></AppButton>
          <AppButton v-else size="lg" :variant="result!.score === null || result!.correct ? 'good' : 'primary'" @click="next">
            <UiLabel :k="isLast ? 'common.finish' : 'common.next'" /> →
          </AppButton>
        </div>
      </div>
    </div>
  </div>
</template>
