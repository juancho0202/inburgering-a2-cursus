<script setup lang="ts">
import { onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../api/client";
import { moduleStyle } from "../lib/moduleStyle";
import AppButton from "../components/ui/AppButton.vue";
import ProgressBar from "../components/ui/ProgressBar.vue";
import ProgressRing from "../components/ui/ProgressRing.vue";
import { useContentStore } from "../stores/content";
import { isBackgroundReady, pickBackground } from "../lib/backgrounds";
import { useSessionStore } from "../stores/session";

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
// A different background each time the dashboard opens; it fades in once it has loaded.
const background = pickBackground();
const backgroundLoaded = ref(isBackgroundReady(background));
const data = ref<Dashboard | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const [d] = await Promise.all([api.get<Dashboard>("/dashboard"), content.course ? null : content.load()]);
    data.value = d;
  } catch (e) {
    error.value = (e as Error).message;
  }
});

const tagLabel = (t: string) => (t.startsWith("writing:") ? `Schrijffout: ${t.slice(8)}` : t.replace(":", " · "));
</script>

<template>
  <!-- Fixed background photo with a soft veil so the cards stay readable -->
  <div class="pointer-events-none fixed inset-0 -z-10" aria-hidden="true">
    <img :src="background" alt="" :class="['h-full w-full object-cover transition-opacity duration-700', backgroundLoaded ? 'opacity-100' : 'opacity-0']" @load="backgroundLoaded = true" />
    <div class="absolute inset-0 bg-bg/35 dark:bg-bg/60" />
  </div>
  <p v-if="error" class="rounded-2xl bg-bad-bg p-4 text-bad">{{ error }}</p>
  <div v-else-if="data" class="glass-cards grid gap-6">
    <section class="card relative overflow-hidden p-6 sm:p-8">
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
          <RouterLink to="/woorden/herhalen">
            <AppButton size="lg" variant="secondary">🔤 Woorden herhalen ({{ data.dueCount + data.newCount }})</AppButton>
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="grid gap-4 sm:grid-cols-2" aria-label="Vandaag">
      <div class="card flex items-center gap-5 p-5">
        <ProgressRing :value="data.minutesToday / data.dailyGoalMinutes">
          <span class="text-lg font-extrabold leading-none">{{ Math.round(data.minutesToday) }}<span class="block text-xs font-semibold text-muted">min</span></span>
        </ProgressRing>
        <div>
          <h2 class="text-lg font-bold">Doel van vandaag</h2>
          <p class="text-muted">{{ Math.round(data.minutesToday) }} van {{ data.dailyGoalMinutes }} minuten</p>
        </div>
      </div>
      <div class="card flex items-center gap-5 p-5">
        <div class="grid h-24 w-24 place-items-center rounded-full bg-brand-bg text-4xl" aria-hidden="true">🔥</div>
        <div>
          <h2 class="text-lg font-bold">Reeks</h2>
          <p class="text-3xl font-extrabold">{{ data.streak.current }} <span class="text-base font-semibold text-muted">{{ data.streak.current === 1 ? "dag" : "dagen" }}</span></p>
          <p class="text-sm text-muted">Beste: {{ data.streak.best }}</p>
        </div>
      </div>
    </section>

    <section>
      <h2 class="glass mb-3 inline-block rounded-2xl px-4 py-1 text-2xl font-bold">Modules</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <RouterLink
          v-for="m in data.modules"
          :key="m.id"
          :to="`/module/${m.id}`"
          class="card group block p-5 transition hover:-translate-y-0.5 hover:shadow-lg"
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

    <section v-if="data.backupReminder.show" class="card flex flex-wrap items-center gap-4 p-5" aria-label="Voortgang bewaren">
      <span class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-bg text-3xl" aria-hidden="true">💾</span>
      <div class="min-w-0 flex-1">
        <h2 class="text-lg font-bold">Bewaar je voortgang</h2>
        <p class="text-muted">
          {{ data.backupReminder.daysAgo === null ? "Je hebt je voortgang nog niet bewaard." : `Laatst bewaard: ${data.backupReminder.daysAgo} dagen geleden.` }}
          Je voortgang staat alleen in deze browser.
        </p>
      </div>
      <AppButton variant="secondary" @click="session.openFinish()">Bewaar nu</AppButton>
    </section>

    <section v-if="data.nextExam" class="card flex flex-wrap items-center gap-4 p-5">
      <span class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-amber-100 text-3xl dark:bg-amber-950" aria-hidden="true">⏱️</span>
      <div class="min-w-0 flex-1">
        <h2 class="text-lg font-bold">Probeer een proefexamen</h2>
        <p class="text-muted">{{ data.nextExam.title }} · {{ data.nextExam.durationMinutes }} minuten</p>
      </div>
      <RouterLink to="/examens"><AppButton variant="secondary">Naar de examens</AppButton></RouterLink>
    </section>

    <section class="card p-6">
      <h2 class="text-2xl font-bold">Dit moet je meer oefenen</h2>
      <p v-if="!data.weakTags.length && !data.hardCount" class="mt-2 text-muted">Nog geen zwakke punten. Doe een paar lessen, dan zie je hier wat beter kan.</p>
      <ul v-else class="mt-3 grid gap-2">
        <li v-for="t in data.weakTags" :key="t.tag" class="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
          <div>
            <p class="font-bold">{{ tagLabel(t.tag) }}</p>
            <p class="text-sm text-muted">{{ Math.round(t.accuracy * 100) }}% goed ({{ t.seen }} antwoorden)</p>
          </div>
          <div class="flex flex-wrap justify-end gap-2">
            <RouterLink :to="{ path: '/oefenen', query: { tag: t.tag } }"><AppButton variant="secondary">Oefen dit</AppButton></RouterLink>
            <RouterLink v-if="!t.tag.startsWith('writing:')" :to="{ path: '/oefenen', query: { gen: 'tag', tag: t.tag } }"><AppButton variant="ghost">🤖 Meer met Claude</AppButton></RouterLink>
          </div>
        </li>
        <li v-if="data.hardCount" class="flex items-center justify-between gap-3 rounded-2xl bg-bad-bg px-4 py-3">
          <p class="font-bold">{{ data.hardCount }} moeilijke {{ data.hardCount === 1 ? "vraag" : "vragen" }}</p>
          <RouterLink :to="{ path: '/oefenen', query: { mode: 'hard' } }"><AppButton variant="secondary">Moeilijke vragen</AppButton></RouterLink>
        </li>
      </ul>
    </section>
  </div>
  <p v-else class="text-muted">Even laden…</p>
</template>
