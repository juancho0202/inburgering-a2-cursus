<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { api } from "../api/client";
import type { Progress, Unit } from "@shared/types";
import { unitScore } from "../lib/unitScore";
import { lessonVoice, stepSegments, type Segment } from "../lib/announce";
import { useSpeech } from "../composables/useSpeech";
import { useSounds } from "../composables/useSounds";
import { useContentStore } from "../stores/content";
import { useSessionStore } from "../stores/session";
import AppButton from "../components/ui/AppButton.vue";
import ProgressBar from "../components/ui/ProgressBar.vue";
import LessonBlocks from "../components/LessonBlocks.vue";
import ReportIssue from "../components/ReportIssue.vue";
import ExerciseShell from "../components/exercises/ExerciseShell.vue";
import ReadAlongButton from "../components/ui/ReadAlongButton.vue";
import ScenePicture from "../components/ScenePicture.vue";
import { warmUnit } from "../lib/illustrations";
import UiLabel from "../components/ui/UiLabel.vue";
import UiText from "../components/ui/UiText.vue";
import { useLanguageStore } from "../stores/language";

const route = useRoute();
const router = useRouter();
const content = useContentStore();
const session = useSessionStore();
const speech = useSpeech();
const sounds = useSounds();
const lang = useLanguageStore();

const unit = ref<Unit | null>(null);
const error = ref<string | null>(null);
const stepIndex = ref(0);
const resumed = ref(false);
const finished = ref(false);
const summary = ref<{ good: number; total: number; score: number; words: number; hard: number } | null>(null);

const unitId = computed(() => String(route.params.id));

async function start(fromStart = false) {
  error.value = null;
  finished.value = false;
  summary.value = null;
  try {
    const [u, p] = await Promise.all([api.get<Unit>(`/units/${unitId.value}`), api.get<Progress>("/progress")]);
    unit.value = u;
    warmUnit(u);
    const saved = p.units[u.id];
    // A completed lesson that was reopened and left halfway keeps its step too (completing resets it to 0).
    const resumeAt = !fromStart && saved && saved.stepIndex > 0 ? Math.min(saved.stepIndex, u.steps.length - 1) : 0;
    stepIndex.value = resumeAt;
    resumed.value = resumeAt > 0;
    if (!content.course) await content.load().catch(() => {});
    announceStep(true);
  } catch (e) {
    error.value = (e as Error).message;
  }
}
// The router reuses this component when only :id changes (e.g. "Volgende les"),
// so reset and reload the unit instead of keeping the previous end screen.
watch(unitId, () => start(), { immediate: true });

const step = computed(() => unit.value?.steps[stepIndex.value]);
const total = computed(() => unit.value?.steps.length ?? 0);
const isLast = computed(() => stepIndex.value >= total.value - 1);

const siblings = computed(() => content.course?.modules.find((m) => m.id === unit.value?.moduleId)?.units ?? []);
const moduleIndex = computed(() => content.course?.modules.findIndex((m) => m.id === unit.value?.moduleId) ?? -1);
const lessonNumber = computed(() => {
  const i = siblings.value.findIndex((u) => u.id === unitId.value);
  return i >= 0 ? i + 1 : undefined;
});

// ----- read-along -----
/** What the voice reads on this step; `resumeAt` is where "▶" continues after a stop. */
const segments = ref<Segment[]>([]);
let resumeAt = 0;
const reading = computed(() => speech.reading.value);
const isRead = (id: string) => speech.activeId.value === id;
const activeBlock = computed(() => {
  const id = speech.activeId.value;
  return id?.startsWith("block-") ? Number(id.slice(6)) : null;
});

async function readFrom(from: number, delayMs = 0, list = segments.value) {
  const at = await speech.read(list, { from, delayMs });
  if (segments.value === list) resumeAt = at >= list.length ? 0 : at;
}
function toggleRead() {
  if (speech.reading.value) speech.stop();
  else void readFrom(resumeAt);
}

/** Read the step aloud. Opening a lesson at step 1 first plays the tune of its lesson number. */
function announceStep(opening = false) {
  const s = step.value;
  if (!unit.value || !s) return;
  speech.setVoice(lessonVoice(lessonNumber.value));
  const first = opening && stepIndex.value === 0;
  const wait = first && lessonNumber.value ? sounds.lessonMelody(lessonNumber.value, Math.max(moduleIndex.value, 0)) : 0;
  const opts = { first, unitTitle: unit.value.title, lessonNumber: lessonNumber.value, goal: stepIndex.value === 0 ? unit.value.goal : undefined };
  segments.value = stepSegments(s, opts);
  // Several exercises in a row with the same instruction: it's said once. The "Lees voor" button still reads it,
  // and reopening a lesson says it again.
  const prev = opening ? undefined : unit.value.steps[stepIndex.value - 1];
  const auto = prev?.type === "exercise" ? stepSegments(s, { ...opts, previousPrompt: prev.exercise.prompt }) : segments.value;
  resumeAt = 0;
  if (speech.autoRead.value) void readFrom(0, wait, auto);
  else speech.stop();
}
onBeforeUnmount(() => {
  speech.stop();
  sounds.stopMusic();
});

const nextUnit = computed(() => {
  const i = siblings.value.findIndex((u) => u.id === unitId.value);
  return i >= 0 ? siblings.value[i + 1] : undefined;
});

async function goTo(index: number) {
  resumed.value = false;
  stepIndex.value = index;
  sounds.stopMusic();
  announceStep();
  api.post(`/units/${unitId.value}/step`, { stepIndex: index }).catch(() => {});
}

// Finishing is slow (it saves to the database), and a double tap or a held-down Enter key would otherwise finish
// the lesson twice: the second time no words are new any more, so the end screen would lose its word count.
// Holds the id of the lesson being finished.
let finishing: string | null = null;
async function advance() {
  const u = unit.value;
  if (!u) return;
  if (!isLast.value) return goTo(stepIndex.value + 1);
  const id = unitId.value;
  if (finishing === id) return;
  finishing = id;
  try {
    const p = await api.get<Progress>("/progress");
    const s = unitScore(u, p);
    const res = await api.post<{ wordsIntroduced: number }>(`/units/${id}/complete`, { score: s.score });
    const hard = await api.get<unknown[]>(`/practice?mode=hard&unit=${id}`).catch(() => []);
    // The learner went to another lesson in the meantime (e.g. browser back): this one is saved, but its end screen
    // must not appear over the new lesson.
    if (unitId.value !== id) return;
    summary.value = { ...s, words: res.wordsIntroduced, hard: hard.length };
    finished.value = true;
    const passed = s.score >= u.passScore;
    sounds.complete(passed);
    speech.announce(passed ? "Les klaar! Goed gedaan." : "Les klaar! Probeer het nog een keer.", 900);
  } finally {
    if (finishing === id) finishing = null;
  }
}

const exit = () => router.push(unit.value ? `/module/${unit.value.moduleId}` : "/");
const restart = async () => {
  await api.post(`/units/${unitId.value}/step`, { stepIndex: 0 }).catch(() => {});
  summary.value = null;
  await start(true);
};
</script>

<template>
  <p v-if="error" class="rounded-2xl bg-bad-bg p-4 text-bad">{{ error }}</p>

  <div v-else-if="unit && finished && summary" class="card slide-up mx-auto max-w-xl p-8 text-center">
    <div class="text-6xl" aria-hidden="true">{{ summary.score >= unit.passScore ? "🎉" : "💪" }}</div>
    <h1 class="mt-3 text-3xl font-extrabold"><UiLabel k="unit.done" /></h1>
    <p class="mt-1 text-xl"><UiText k="common.score" md :params="{ good: summary.good, total: summary.total }" /> ({{ Math.round(summary.score * 100) }}%)</p>
    <p class="mt-1 text-muted">{{ lang.feedback(summary.score >= unit.passScore ? "unit.passed" : "unit.notPassed") }}</p>
    <p v-if="summary.words" class="mt-2 rounded-2xl bg-brand-bg px-4 py-2 font-semibold">📕 {{ lang.t("unit.newCards", { n: summary.words }, summary.words) }}</p>
    <div class="mt-6 grid gap-3">
      <RouterLink v-if="nextUnit" :to="`/unit/${nextUnit.id}`"><AppButton size="lg" class="w-full"><UiLabel k="unit.nextLesson" />: <span lang="nl" translate="no">{{ nextUnit.title }}</span> →</AppButton></RouterLink>
      <RouterLink v-if="summary.hard" :to="{ path: '/oefenen', query: { mode: 'hard', unit: unit.id } }"><AppButton variant="secondary" class="w-full"><UiLabel k="dashboard.hardQuestions" /> ({{ summary.hard }})</AppButton></RouterLink>
      <RouterLink :to="{ path: '/oefenen', query: { gen: 'unit', unit: unit.id } }"><AppButton variant="secondary" class="w-full">🤖 <UiLabel k="practice.moreClaude" /></AppButton></RouterLink>
      <AppButton variant="secondary" @click="restart"><UiLabel k="common.again" /></AppButton>
      <AppButton variant="secondary" @click="session.openFinish()">🌙 <UiLabel k="app.finish" /></AppButton>
      <AppButton variant="ghost" @click="exit"><UiLabel k="unit.backToModule" /></AppButton>
    </div>
  </div>

  <div v-else-if="unit && step">
    <div class="mb-6">
      <div class="mb-2 flex items-center justify-between gap-3">
        <h1 class="truncate text-lg font-bold text-muted"><template v-if="lessonNumber"><UiLabel k="settings.lessonN" :params="{ n: lessonNumber }" /> · </template><span lang="nl" translate="no">{{ unit.title }}</span></h1>
        <span class="text-sm font-semibold text-muted">{{ stepIndex + 1 }} / {{ total }}</span>
      </div>
      <ProgressBar :value="stepIndex / total" :label="lang.t('unit.stepOf', { n: stepIndex + 1, total })" />
      <p v-if="resumed" class="mt-2 text-sm text-brand-strong">{{ lang.t("unit.resumed", { n: stepIndex + 1 }) }}</p>
    </div>

    <template v-if="step.type === 'lesson'">
      <div :key="stepIndex" class="slide-up pb-28" lang="nl" translate="no">
        <h2 class="read-along mb-2 text-3xl font-extrabold tracking-tight" :class="{ 'is-reading': isRead('heading') }">{{ step.title }}</h2>
        <ReadAlongButton class="mb-3" :reading="reading" :label="lang.t('common.readAloud')" :stop-label="lang.t('common.stopReading')" @toggle="toggleRead" />
        <p v-if="stepIndex === 0" class="read-along mb-5 text-muted" :class="{ 'is-reading': isRead('goal') }">{{ unit.goal }}</p>
        <div v-else class="mb-3" />
        <!-- The lesson opens with its picture, like a chapter in a language book -->
        <ScenePicture v-if="stepIndex === 0 && unit.scene" :id="unit.scene" class="mb-6 max-w-2xl" />
        <LessonBlocks :blocks="step.blocks" :active="activeBlock" />
        <div class="mt-10 flex justify-center"><ReportIssue :item-id="step.id" /></div>
      </div>
      <div class="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
        <div class="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <AppButton variant="ghost" @click="stepIndex === 0 ? exit() : goTo(stepIndex - 1)"><template v-if="stepIndex === 0"><UiLabel k="common.stop" /></template><template v-else>← <UiLabel k="common.previous" /></template></AppButton>
          <AppButton size="lg" @click="advance"><UiLabel v-if="isLast" k="common.finish" /><template v-else><UiLabel k="common.next" /> →</template></AppButton>
        </div>
      </div>
    </template>

    <template v-else>
      <ScenePicture v-if="stepIndex === 0 && unit.scene" :id="unit.scene" class="mb-6 max-w-xl" />
      <ReadAlongButton class="mb-4" :reading="reading" :label="lang.t('unit.readQuestion')" :stop-label="lang.t('common.stopReading')" @toggle="toggleRead" />
      <ExerciseShell :key="stepIndex" :exercise="step.exercise" :is-last="isLast" @done="advance" @exit="exit" />
    </template>
  </div>
  <p v-else class="text-muted">{{ lang.t("common.loading") }}</p>
</template>
