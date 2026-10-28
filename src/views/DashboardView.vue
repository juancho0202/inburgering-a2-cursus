<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../api/client";
import AppButton from "../components/ui/AppButton.vue";
import ModuleCards from "../components/ModuleCards.vue";
import GoalGauge from "../components/ui/GoalGauge.vue";
import ProgressRing from "../components/ui/ProgressRing.vue";
import { useContentStore } from "../stores/content";
import { isBackgroundReady, pickBackground } from "../lib/backgrounds";
import { warmScenes } from "../lib/illustrations";
import { useSessionStore } from "../stores/session";
import { useReviewStore } from "../stores/review";
import { useLanguageStore } from "../stores/language";
import { useSettingsStore } from "../stores/settings";
import LanguagePicker from "../components/LanguagePicker.vue";
import UiLabel from "../components/ui/UiLabel.vue";
import UiText from "../components/ui/UiText.vue";

interface Dashboard {
  nextUnitId: string | null;
  lastLocation: { unitId: string; unitTitle: string; stepIndex: number; stepCount: number } | null;
  dailyGoalMinutes: number;
  minutesToday: number;
  streak: { current: number; best: number };
  dueCount: number;
  newCount: number;
  modules: { id: string; title: string; total: number; completed: number }[];
  hardCount: number;
  weakTags: { tag: string; accuracy: number; seen: number }[];
  backupReminder: { show: boolean; daysAgo: number | null; unsavedAnswers: number };
  nextExam: { id: string; title: string; skill: string; durationMinutes: number } | null;
}

const content = useContentStore();
const session = useSessionStore();
const review = useReviewStore();
const lang = useLanguageStore();
const settings = useSettingsStore();
// A different background each time the dashboard opens. One that is ready at once (it was downloaded ahead of time)
// just appears; only one that takes longer fades in, so there is no blank moment and no needless fade.
const background = pickBackground();
const backgroundLoaded = ref(isBackgroundReady(background));
const backgroundFades = ref(false);
setTimeout(() => (backgroundFades.value = !backgroundLoaded.value), 120);
const data = ref<Dashboard | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const [d] = await Promise.all([api.get<Dashboard>("/dashboard"), content.course ? null : content.load()]);
    data.value = d;
    review.count = d.dueCount + d.newCount;
    // The module the learner will most likely open next: get its lesson pictures ready while they look around.
    const unitId = d.lastLocation?.unitId ?? d.nextUnitId;
    const next = content.course?.modules.find((m) => m.units.some((u) => u.id === unitId));
    if (next) setTimeout(() => warmModule(next.id), 600);
  } catch (e) {
    error.value = (e as Error).message;
  }
});

/** Download the lesson pictures of a module (when it is about to be opened), so its list shows them at once. */
const warmModule = (id: string) => warmScenes(content.course?.modules.find((m) => m.id === id)?.units.map((u) => u.scene) ?? []);

const tagLabel = (t: string) => (t.startsWith("writing:") ? lang.t("dashboard.writingMistake", { tag: t.slice(8) }) : t.replace(":", " · "));
</script>

<template>
  <!-- Fixed background photo with a soft veil so the cards stay readable -->
  <div class="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
    <img
      :src="background"
      alt=""
      fetchpriority="high"
      :class="['h-full w-full object-cover', backgroundFades && 'transition-opacity duration-500', backgroundLoaded ? 'opacity-100' : 'opacity-0']"
      @load="backgroundLoaded = true"
    />
    <div class="absolute inset-0 bg-bg/35 dark:bg-bg/60" />
  </div>
  <p v-if="error" class="rounded-2xl bg-bad-bg p-4 text-bad">{{ error }}</p>
  <div v-else-if="data" class="glass-cards grid gap-6">
    <!-- Learners from before the app had languages: ask once (new learners choose on the welcome page) -->
    <section v-if="settings.settings && !lang.chosen" class="card p-6"><LanguagePicker /></section>
    <!-- From tablet width the two small tiles sit inside the welcome card, on its right: the card spans both columns
         (one big card, as on a phone) and its text stays in the left one, so the tiles never cover it. -->
    <div class="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:gap-0">
    <section class="card relative overflow-hidden p-6 sm:p-8 md:col-span-2 md:col-start-1 md:row-start-1 md:grid md:grid-cols-subgrid">
      <div class="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-brand-bg" aria-hidden="true" />
      <div class="relative">
        <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl"><span aria-hidden="true">👋 </span><UiLabel variant="heading" k="dashboard.welcomeBack" /></h1>
        <p class="mt-1 text-muted">
          <UiText v-if="data.lastLocation" k="dashboard.busyWith" :params="{ title: data.lastLocation.unitTitle }" />
          <UiText v-else k="dashboard.ready" />
        </p>
        <div class="mt-5 flex flex-wrap gap-3">
          <RouterLink v-if="data.lastLocation" :to="`/unit/${data.lastLocation.unitId}`">
            <AppButton size="lg">▶ <UiLabel k="dashboard.continue" /></AppButton>
          </RouterLink>
          <RouterLink v-else-if="data.nextUnitId" :to="`/unit/${data.nextUnitId}`">
            <AppButton size="lg">▶ <UiLabel k="welcome.start" /></AppButton>
          </RouterLink>
          <!-- Hidden when there is nothing to review: a "(0)" button only pushes the modules further down on a phone.
               On a phone it is a small badge in the top bar instead (App.vue), so the modules come into view sooner. -->
          <RouterLink v-if="data.dueCount + data.newCount" to="/woorden/herhalen" class="hidden md:inline-block">
            <AppButton size="lg" variant="secondary">📕 <UiLabel k="app.reviewWords" :params="{ count: data.dueCount + data.newCount }" /></AppButton>
          </RouterLink>
        </div>
      </div>
    </section>

    <!-- Two small tiles side by side, phone-sized on every screen, so the modules come into view sooner -->
    <section class="relative grid grid-cols-2 gap-4 md:col-start-2 md:row-start-1 md:self-center md:py-8 md:pr-8" :aria-label="lang.t('dashboard.today')">
      <div class="card relative flex flex-col items-center justify-center p-4 pb-8 md:w-36">
        <GoalGauge :minutes="data.minutesToday" :goal="data.dailyGoalMinutes" />
        <span class="text-xs font-semibold text-muted" aria-hidden="true">{{ lang.t("dashboard.minutes") }}</span>
        <!-- The titles are small tabs on the bottom edge, so they cost no height -->
        <h2 class="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-t-xl bg-brand-bg px-3 py-1 text-xs font-bold text-brand-strong"><span aria-hidden="true">⏱️</span> <UiLabel variant="inline" k="dashboard.today" /></h2>
      </div>
      <div class="card relative flex flex-col items-center justify-center p-4 pb-8 md:w-36">
        <!-- A plain circle, without progress: a streak has no target. As tall as the goal gauge with its label. -->
        <ProgressRing :value="0" :size="104">
          <span class="text-2xl font-extrabold leading-none">{{ data.streak.current }}<span class="block text-xs font-semibold text-muted">{{ lang.t("dashboard.days", {}, data.streak.current) }}</span></span>
        </ProgressRing>
        <h2 class="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-t-xl bg-brand-bg px-3 py-1 text-xs font-bold text-brand-strong"><span aria-hidden="true">🔥</span> <UiLabel variant="inline" k="dashboard.streak" /></h2>
      </div>
    </section>
    </div>

    <!-- The rest of the page goes inside, so the sticky "Klaar" of edit mode stays in reach down to the end -->
    <ModuleCards :modules="data.modules" @warm="warmModule">
      <section v-if="data.backupReminder.show" class="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center" :aria-label="lang.t('dashboard.backupTitle')">
        <div class="flex min-w-0 flex-1 items-start gap-4 sm:items-center">
          <span class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-bg text-3xl" aria-hidden="true">💾</span>
          <div class="min-w-0 flex-1">
            <h2 class="text-lg font-bold"><UiLabel variant="heading" k="dashboard.backupTitle" /></h2>
            <p class="text-muted">
              <UiText v-if="data.backupReminder.daysAgo === null" k="dashboard.neverSaved" />
              <UiText v-else k="dashboard.savedDaysAgo" :params="{ days: data.backupReminder.daysAgo }" :count="data.backupReminder.daysAgo" />
              {{ " " }}<UiText k="dashboard.onlyHere" />
            </p>
          </div>
        </div>
        <AppButton variant="secondary" class="w-full sm:w-auto" @click="session.openFinish()"><UiLabel k="dashboard.saveNow" /></AppButton>
      </section>

      <section v-if="data.nextExam" class="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
        <div class="flex min-w-0 flex-1 items-start gap-4 sm:items-center">
          <span class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-100 text-3xl dark:bg-amber-950" aria-hidden="true">⏱️</span>
          <div class="min-w-0 flex-1">
            <h2 class="text-lg font-bold"><UiLabel variant="heading" k="dashboard.tryExam" /></h2>
            <p class="text-muted"><span lang="nl" translate="no">{{ data.nextExam.title }}</span> · {{ lang.t("common.minutes", { n: data.nextExam.durationMinutes }) }}</p>
          </div>
        </div>
        <RouterLink to="/examens" class="block sm:inline-block"><AppButton variant="secondary" class="w-full sm:w-auto"><UiLabel k="dashboard.toExams" /></AppButton></RouterLink>
      </section>

      <section class="card p-6">
        <h2 class="text-2xl font-bold"><UiLabel variant="heading" k="dashboard.practiseMore" /></h2>
        <p v-if="!data.weakTags.length && !data.hardCount" class="mt-2 text-muted"><UiText k="dashboard.practiseMoreEmpty" /></p>
        <ul v-else class="mt-3 grid gap-2">
          <li v-for="t in data.weakTags" :key="t.tag" class="flex flex-col gap-3 rounded-2xl bg-surface-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p class="font-bold">{{ tagLabel(t.tag) }}</p>
              <p class="text-sm text-muted">{{ lang.t("dashboard.accuracy", { pct: Math.round(t.accuracy * 100), seen: t.seen }) }}</p>
            </div>
            <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <RouterLink :to="{ path: '/oefenen', query: { tag: t.tag } }" class="block"><AppButton variant="secondary" class="w-full sm:w-auto"><UiLabel k="dashboard.practiseThis" /></AppButton></RouterLink>
              <RouterLink v-if="!t.tag.startsWith('writing:')" class="block" :to="{ path: '/oefenen', query: { gen: 'tag', tag: t.tag } }"><AppButton variant="ghost" class="w-full sm:w-auto">🤖 <UiLabel k="dashboard.moreWithClaude" /></AppButton></RouterLink>
            </div>
          </li>
          <li v-if="data.hardCount" class="flex flex-col gap-3 rounded-2xl bg-bad-bg px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p class="font-bold">{{ lang.t("dashboard.hardCount", { n: data.hardCount }, data.hardCount) }}</p>
            <RouterLink :to="{ path: '/oefenen', query: { mode: 'hard' } }" class="block"><AppButton variant="secondary" class="w-full sm:w-auto"><UiLabel k="dashboard.hardQuestions" /></AppButton></RouterLink>
          </li>
        </ul>
      </section>
    </ModuleCards>
  </div>
  <p v-else class="text-muted">{{ lang.t("common.loading") }}</p>
</template>
