<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../api/client";
import { moduleStyle } from "../lib/moduleStyle";
import AppButton from "../components/ui/AppButton.vue";
import ProgressBar from "../components/ui/ProgressBar.vue";
import GoalGauge from "../components/ui/GoalGauge.vue";
import ProgressRing from "../components/ui/ProgressRing.vue";
import { useContentStore } from "../stores/content";
import { isBackgroundReady, pickBackground } from "../lib/backgrounds";
import { warmScenes } from "../lib/illustrations";
import { useSessionStore } from "../stores/session";
import { useReviewStore } from "../stores/review";

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

const tagLabel = (t: string) => (t.startsWith("writing:") ? `Schrijffout: ${t.slice(8)}` : t.replace(":", " · "));
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
    <!-- From tablet width the two small tiles sit inside the welcome card, on its right: the card spans both columns
         (one big card, as on a phone) and its text stays in the left one, so the tiles never cover it. -->
    <div class="grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] md:gap-0">
    <section class="card relative overflow-hidden p-6 sm:p-8 md:col-span-2 md:col-start-1 md:row-start-1 md:grid md:grid-cols-subgrid">
      <div class="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-brand-bg" aria-hidden="true" />
      <div class="relative">
        <h1 class="text-3xl font-extrabold tracking-tight sm:text-4xl">Welkom terug! 👋</h1>
        <p class="mt-1 text-muted">
          {{ data.lastLocation ? `Je was bezig met: ${data.lastLocation.unitTitle}.` : "Klaar om te leren? Begin met een les." }}
        </p>
        <div class="mt-5 flex flex-wrap gap-3">
          <RouterLink v-if="data.lastLocation" :to="`/unit/${data.lastLocation.unitId}`">
            <AppButton size="lg">▶ Verder waar ik was</AppButton>
          </RouterLink>
          <RouterLink v-else-if="data.nextUnitId" :to="`/unit/${data.nextUnitId}`">
            <AppButton size="lg">▶ Begin met leren</AppButton>
          </RouterLink>
          <!-- Hidden when there is nothing to review: a "(0)" button only pushes the modules further down on a phone.
               On a phone it is a small badge in the top bar instead (App.vue), so the modules come into view sooner. -->
          <RouterLink v-if="data.dueCount + data.newCount" to="/woorden/herhalen" class="hidden md:inline-block">
            <AppButton size="lg" variant="secondary">📕 Woorden herhalen ({{ data.dueCount + data.newCount }})</AppButton>
          </RouterLink>
        </div>
      </div>
    </section>

    <!-- Two small tiles side by side, phone-sized on every screen, so the modules come into view sooner -->
    <section class="relative grid grid-cols-2 gap-4 md:col-start-2 md:row-start-1 md:self-center md:py-8 md:pr-8" aria-label="Vandaag">
      <div class="card relative flex flex-col items-center justify-center p-4 pb-8 md:w-36">
        <GoalGauge :minutes="data.minutesToday" :goal="data.dailyGoalMinutes" />
        <span class="text-xs font-semibold text-muted" aria-hidden="true">minuten</span>
        <!-- The titles are small tabs on the bottom edge, so they cost no height -->
        <h2 class="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-t-xl bg-brand-bg px-3 py-1 text-xs font-bold text-brand-strong"><span aria-hidden="true">⏱️</span> Vandaag</h2>
      </div>
      <div class="card relative flex flex-col items-center justify-center p-4 pb-8 md:w-36">
        <!-- A plain circle, without progress: a streak has no target. As tall as the goal gauge with its label. -->
        <ProgressRing :value="0" :size="104">
          <span class="text-2xl font-extrabold leading-none">{{ data.streak.current }}<span class="block text-xs font-semibold text-muted">{{ data.streak.current === 1 ? "dag" : "dagen" }}</span></span>
        </ProgressRing>
        <h2 class="absolute bottom-0 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-t-xl bg-brand-bg px-3 py-1 text-xs font-bold text-brand-strong"><span aria-hidden="true">🔥</span> Reeks</h2>
      </div>
    </section>
    </div>

    <section>
      <h2 class="glass mb-3 inline-block rounded-2xl px-4 py-1 text-2xl font-bold">Modules</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <RouterLink
          v-for="m in data.modules"
          :key="m.id"
          :to="`/module/${m.id}`"
          class="card group block p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
          @pointerenter="warmModule(m.id)"
          @focus="warmModule(m.id)"
          @touchstart.passive="warmModule(m.id)"
        >
          <div class="flex items-center gap-4">
            <span class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl" :class="moduleStyle(m.id).tile" aria-hidden="true">{{ moduleStyle(m.id).emoji }}</span>
            <div class="min-w-0 flex-1">
              <h3 class="text-xl font-bold group-hover:text-brand-strong">{{ m.title }}</h3>
              <p v-if="m.total" class="text-sm text-muted">{{ m.completed }} van {{ m.total }} lessen klaar</p>
              <p v-else class="text-sm text-muted">Oefen onder examentijd</p>
            </div>
          </div>
          <div v-if="m.total" class="mt-4"><ProgressBar :value="m.total ? m.completed / m.total : 0" :label="`Voortgang ${m.title}`" /></div>
        </RouterLink>
      </div>
    </section>

    <section v-if="data.backupReminder.show" class="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center" aria-label="Voortgang bewaren">
      <div class="flex min-w-0 flex-1 items-start gap-4 sm:items-center">
        <span class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-bg text-3xl" aria-hidden="true">💾</span>
        <div class="min-w-0 flex-1">
          <h2 class="text-lg font-bold">Bewaar je voortgang</h2>
          <p class="text-muted">
            {{ data.backupReminder.daysAgo === null ? "Je hebt je voortgang nog niet bewaard." : `Laatst bewaard: ${data.backupReminder.daysAgo} dagen geleden.` }}
            Je voortgang staat alleen in deze browser.
          </p>
        </div>
      </div>
      <AppButton variant="secondary" class="w-full sm:w-auto" @click="session.openFinish()">Bewaar nu</AppButton>
    </section>

    <section v-if="data.nextExam" class="card flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
      <div class="flex min-w-0 flex-1 items-start gap-4 sm:items-center">
        <span class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-100 text-3xl dark:bg-amber-950" aria-hidden="true">⏱️</span>
        <div class="min-w-0 flex-1">
          <h2 class="text-lg font-bold">Probeer een proefexamen</h2>
          <p class="text-muted">{{ data.nextExam.title }} · {{ data.nextExam.durationMinutes }} minuten</p>
        </div>
      </div>
      <RouterLink to="/examens" class="block sm:inline-block"><AppButton variant="secondary" class="w-full sm:w-auto">Naar de examens</AppButton></RouterLink>
    </section>

    <section class="card p-6">
      <h2 class="text-2xl font-bold">Dit moet je meer oefenen</h2>
      <p v-if="!data.weakTags.length && !data.hardCount" class="mt-2 text-muted">Doe een paar lessen, dan zie je hier wat beter kan.</p>
      <ul v-else class="mt-3 grid gap-2">
        <li v-for="t in data.weakTags" :key="t.tag" class="flex flex-col gap-3 rounded-2xl bg-surface-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p class="font-bold">{{ tagLabel(t.tag) }}</p>
            <p class="text-sm text-muted">{{ Math.round(t.accuracy * 100) }}% goed ({{ t.seen }} antwoorden)</p>
          </div>
          <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <RouterLink :to="{ path: '/oefenen', query: { tag: t.tag } }" class="block"><AppButton variant="secondary" class="w-full sm:w-auto">Oefen dit</AppButton></RouterLink>
            <RouterLink v-if="!t.tag.startsWith('writing:')" class="block" :to="{ path: '/oefenen', query: { gen: 'tag', tag: t.tag } }"><AppButton variant="ghost" class="w-full sm:w-auto">🤖 Meer met Claude</AppButton></RouterLink>
          </div>
        </li>
        <li v-if="data.hardCount" class="flex flex-col gap-3 rounded-2xl bg-bad-bg px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p class="font-bold">{{ data.hardCount }} moeilijke {{ data.hardCount === 1 ? "vraag" : "vragen" }}</p>
          <RouterLink :to="{ path: '/oefenen', query: { mode: 'hard' } }" class="block"><AppButton variant="secondary" class="w-full sm:w-auto">Moeilijke vragen</AppButton></RouterLink>
        </li>
      </ul>
    </section>
  </div>
  <p v-else class="text-muted">Even laden…</p>
</template>
