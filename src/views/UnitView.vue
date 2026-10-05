<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { api } from "../api/client";
import type { Progress, Unit } from "@shared/types";
import { unitScore } from "../lib/unitScore";
import { useContentStore } from "../stores/content";
import { useSessionStore } from "../stores/session";
import AppButton from "../components/ui/AppButton.vue";
import ProgressBar from "../components/ui/ProgressBar.vue";
import LessonBlocks from "../components/LessonBlocks.vue";
import ExerciseShell from "../components/exercises/ExerciseShell.vue";

const route = useRoute();
const router = useRouter();
const content = useContentStore();
const session = useSessionStore();

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
  try {
    const [u, p] = await Promise.all([api.get<Unit>(`/units/${unitId.value}`), api.get<Progress>("/progress")]);
    unit.value = u;
    const saved = p.units[u.id];
    const resumeAt = !fromStart && saved?.status === "in_progress" ? Math.min(saved.stepIndex, u.steps.length - 1) : 0;
    stepIndex.value = resumeAt;
    resumed.value = resumeAt > 0;
    if (!content.course) content.load();
  } catch (e) {
    error.value = (e as Error).message;
  }
}
onMounted(() => start());

const step = computed(() => unit.value?.steps[stepIndex.value]);
const total = computed(() => unit.value?.steps.length ?? 0);
const isLast = computed(() => stepIndex.value >= total.value - 1);

const siblings = computed(() => content.course?.modules.find((m) => m.id === unit.value?.moduleId)?.units ?? []);
const nextUnit = computed(() => {
  const i = siblings.value.findIndex((u) => u.id === unitId.value);
  return i >= 0 ? siblings.value[i + 1] : undefined;
});

async function goTo(index: number) {
  resumed.value = false;
  stepIndex.value = index;
  api.post(`/units/${unitId.value}/step`, { stepIndex: index }).catch(() => {});
}

async function advance() {
  if (!unit.value) return;
  if (!isLast.value) return goTo(stepIndex.value + 1);
  const p = await api.get<Progress>("/progress");
  const s = unitScore(unit.value, p);
  const res = await api.post<{ wordsIntroduced: number }>(`/units/${unitId.value}/complete`, { score: s.score });
  const hard = await api.get<unknown[]>(`/practice?mode=hard&unit=${unitId.value}`).catch(() => []);
  summary.value = { ...s, words: res.wordsIntroduced, hard: hard.length };
  finished.value = true;
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
    <h1 class="mt-3 text-3xl font-extrabold">Les klaar!</h1>
    <p class="mt-1 text-xl">Je score: <strong>{{ summary.good }} van {{ summary.total }}</strong> ({{ Math.round(summary.score * 100) }}%)</p>
    <p class="mt-1 text-muted">{{ summary.score >= unit.passScore ? "Goed gedaan! Je hebt deze les gehaald." : "Bijna! Probeer de les nog een keer." }}</p>
    <p v-if="summary.words" class="mt-2 rounded-2xl bg-brand-bg px-4 py-2 font-semibold">🔤 {{ summary.words }} nieuwe woordkaartjes om te herhalen</p>
    <div class="mt-6 grid gap-3">
      <RouterLink v-if="nextUnit" :to="`/unit/${nextUnit.id}`"><AppButton size="lg" class="w-full">Volgende les: {{ nextUnit.title }} →</AppButton></RouterLink>
      <RouterLink v-if="summary.hard" :to="{ path: '/oefenen', query: { mode: 'hard', unit: unit.id } }"><AppButton variant="secondary" class="w-full">Moeilijke vragen ({{ summary.hard }})</AppButton></RouterLink>
      <RouterLink :to="{ path: '/oefenen', query: { gen: 'unit', unit: unit.id } }"><AppButton variant="secondary" class="w-full">🤖 Meer oefenen met Claude</AppButton></RouterLink>
      <AppButton variant="secondary" @click="restart">Opnieuw</AppButton>
      <AppButton variant="secondary" @click="session.openFinish()">🌙 Klaar voor vandaag</AppButton>
      <AppButton variant="ghost" @click="exit">Terug naar de module</AppButton>
    </div>
  </div>

  <div v-else-if="unit && step">
    <div class="mb-6">
      <div class="mb-2 flex items-center justify-between gap-3">
        <h1 class="truncate text-lg font-bold text-muted">{{ unit.title }}</h1>
        <span class="text-sm font-semibold text-muted">{{ stepIndex + 1 }} / {{ total }}</span>
      </div>
      <ProgressBar :value="stepIndex / total" :label="`Stap ${stepIndex + 1} van ${total}`" />
      <p v-if="resumed" class="mt-2 text-sm text-brand-strong">Je gaat verder bij stap {{ stepIndex + 1 }}.</p>
    </div>

    <template v-if="step.type === 'lesson'">
      <div :key="stepIndex" class="slide-up pb-28">
        <h2 class="mb-1 text-3xl font-extrabold tracking-tight">{{ step.title }}</h2>
        <p v-if="stepIndex === 0" class="mb-5 text-muted">{{ unit.goal }}</p>
        <div v-else class="mb-5" />
        <LessonBlocks :blocks="step.blocks" />
      </div>
      <div class="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
        <div class="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
          <AppButton variant="ghost" @click="stepIndex === 0 ? exit() : goTo(stepIndex - 1)">{{ stepIndex === 0 ? "Stoppen" : "← Vorige" }}</AppButton>
          <AppButton size="lg" @click="advance">{{ isLast ? "Afronden" : "Volgende →" }}</AppButton>
        </div>
      </div>
    </template>

    <ExerciseShell v-else :key="stepIndex" :exercise="step.exercise" :is-last="isLast" @done="advance" @exit="exit" />
  </div>
  <p v-else class="text-muted">Even laden…</p>
</template>
