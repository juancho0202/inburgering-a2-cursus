<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../api/client";
import AppButton from "../components/ui/AppButton.vue";
import { DISCLAIMER, skillEmoji, skillLabel } from "../lib/examLabels";

interface ExamRow {
  id: string;
  skill: string;
  title: string;
  durationMinutes: number;
  passScore: number;
  questionCount: number;
  inProgress: { id: string; startedAt: string } | null;
  attempts: { id: string; finishedAt: string; score: number; max: number }[];
}

const exams = ref<ExamRow[] | null>(null);
const error = ref<string | null>(null);
onMounted(async () => {
  try {
    exams.value = await api.get<ExamRow[]>("/exams");
  } catch (e) {
    error.value = (e as Error).message;
  }
});

const groups = computed(() =>
  (["lezen", "knm", "schrijven"] as const).map((skill) => ({ skill, rows: (exams.value ?? []).filter((e) => e.skill === skill) })).filter((g) => g.rows.length),
);
const fmt = (iso: string) => new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
const pct = (a: { score: number; max: number }) => (a.max ? Math.round((a.score / a.max) * 100) : 0);
const unitFor = (skill: string) => (skill === "schrijven" ? "opdrachten" : "vragen");
</script>

<template>
  <div>
    <h1 class="text-3xl font-extrabold tracking-tight">Proefexamens</h1>
    <p class="mt-1 text-muted">Oefen onder examentijd. Je ziet pas na het inleveren of je antwoorden goed zijn.</p>
    <p class="mt-3 rounded-2xl bg-brand-bg px-4 py-3 font-semibold text-brand-strong">{{ DISCLAIMER }} DUO publiceert geen vaste slaaggrens; onze eigen oefengrens is 70%.</p>

    <p v-if="error" class="mt-4 rounded-2xl bg-bad-bg p-4 text-bad">{{ error }}</p>
    <p v-else-if="!exams" class="mt-4 text-muted">Even laden…</p>

    <section v-for="g in groups" :key="g.skill" class="mt-8">
      <h2 class="mb-3 flex items-center gap-2 text-2xl font-bold"><span aria-hidden="true">{{ skillEmoji[g.skill] }}</span> {{ skillLabel[g.skill] }}</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <article v-for="e in g.rows" :key="e.id" class="card p-5">
          <h3 class="text-xl font-bold">{{ e.title }}</h3>
          <p class="text-sm text-muted">{{ e.durationMinutes }} minuten · {{ e.questionCount }} {{ unitFor(e.skill) }}</p>

          <ul v-if="e.attempts.length" class="mt-3 grid gap-1 text-sm">
            <li v-for="a in e.attempts.slice(-3).reverse()" :key="a.id" class="flex items-center justify-between rounded-xl bg-surface-2 px-3 py-1.5">
              <span>{{ fmt(a.finishedAt) }}</span>
              <RouterLink :to="`/examen/${e.id}/resultaat/${a.id}`" class="font-bold hover:text-brand-strong">
                {{ a.score }} / {{ a.max }} ({{ pct(a) }}%) →
              </RouterLink>
            </li>
          </ul>
          <p v-else class="mt-3 text-sm text-muted">Nog niet gemaakt.</p>

          <p v-if="e.inProgress" class="mt-3 text-sm font-semibold text-brand-strong">Je bent bezig. De tijd loopt door.</p>
          <RouterLink :to="`/examen/${e.id}`" class="mt-4 block">
            <AppButton class="w-full" :variant="e.inProgress ? 'primary' : 'secondary'">{{ e.inProgress ? "Verder met het examen" : e.attempts.length ? "Opnieuw maken" : "Start het examen" }}</AppButton>
          </RouterLink>
        </article>
      </div>
    </section>
  </div>
</template>
