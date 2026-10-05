<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";
import type { Exam, Exercise, Progress } from "@shared/types";
import type { WritingFeedback } from "@shared/schemas/claude";
import { examExercises, examQuestions, selectedIndexes } from "@shared/logic/exam";
import { matchesAny } from "@shared/logic/answers";
import { api } from "../api/client";
import { useSettingsStore } from "../stores/settings";
import AppButton from "../components/ui/AppButton.vue";
import ProgressBar from "../components/ui/ProgressBar.vue";
import WritingFeedbackPanel from "../components/WritingFeedbackPanel.vue";
import ReportIssue from "../components/ReportIssue.vue";
import { DISCLAIMER, themeLabel } from "../lib/examLabels";

type Result = Progress["exams"][number];
interface Submission {
  id: string;
  text: string;
  feedback: WritingFeedback | null;
}

const route = useRoute();
const settings = useSettingsStore();
const exam = ref<Exam | null>(null);
const result = ref<Result | null>(null);
const submissions = ref<Record<string, Submission>>({});
const error = ref<string | null>(null);

// Claude feedback for Schrijven tasks, one after the other
const taskState = ref<Record<string, { status: "wait" | "busy" | "done" | "error"; error?: string }>>({});
const running = ref(false);

onMounted(async () => {
  if (!settings.settings) settings.load();
  try {
    [exam.value, result.value] = await Promise.all([api.get<Exam>(`/exams/${route.params.id}`), api.get<Result>(`/exams/results/${route.params.rid}`)]);
    await loadSubmissions();
    if (exam.value.skill === "schrijven") {
      if (!settings.settings) await settings.load();
      if (settings.hasKey) await runPending();
    }
  } catch (e) {
    error.value = (e as Error).message;
  }
});

async function loadSubmissions() {
  const all = await api.get<Submission[]>("/writing");
  submissions.value = Object.fromEntries(all.map((s) => [s.id, s]));
}

const details = computed(() => (result.value?.details ?? {}) as Record<string, any>);
const pct = computed(() => (result.value && result.value.max ? Math.round((result.value.score / result.value.max) * 100) : null));
const passed = computed(() => pct.value !== null && exam.value !== null && pct.value / 100 >= exam.value.passScore);
// A Schrijven result is only final when every written text has a score.
const incomplete = computed(() => tasks.value.some((t) => t.type === "writing" && details.value[t.id]?.submissionId && typeof details.value[t.id]?.points !== "number"));

// ----- KNM / Lezen -----
const questions = computed(() => (exam.value && exam.value.skill !== "schrijven" ? examQuestions(exam.value) : []));
const wrong = computed(() => questions.value.filter((q) => details.value[q.id]?.correct === false));
const themes = computed(() =>
  Object.entries(result.value?.byTheme ?? {})
    .map(([tag, [good, total]]) => ({ tag, label: themeLabel(tag), good, total }))
    .sort((a, b) => a.good / a.total - b.good / b.total),
);
function yourAnswer(q: (typeof questions.value)[number]): string {
  const ex = q.exercise;
  if (ex.type !== "mc") return "";
  const sel = selectedIndexes(result.value?.answers[q.id]);
  return sel.length ? ex.options[sel[0]] : "Niet beantwoord";
}
const correctText = (ex: Exercise) => (ex.type === "mc" ? ex.options[ex.answer] : "");

// ----- Schrijven -----
const tasks = computed(() => (exam.value?.skill === "schrijven" ? examExercises(exam.value) : []));
const submissionOf = (id: string) => submissions.value[details.value[id]?.submissionId as string];
const fieldRows = (item: Extract<Exercise, { type: "form-fill" }>) => {
  const values = (result.value?.answers[item.id] as string[] | undefined) ?? [];
  return item.fields.map((f, i) => ({ label: f.label, value: values[i] ?? "", expected: f.expected, ok: f.expected === undefined ? null : matchesAny(values[i] ?? "", [f.expected]) }));
};

async function runPending() {
  if (!exam.value || !result.value) return;
  const todo = tasks.value.filter((t) => t.type === "writing" && details.value[t.id]?.submissionId && typeof details.value[t.id]?.points !== "number");
  if (!todo.length) return;
  running.value = true;
  for (const t of todo) taskState.value[t.id] = { status: "wait" };
  for (const t of todo) {
    taskState.value[t.id] = { status: "busy" };
    try {
      await api.post("/claude/feedback-writing", { exerciseId: t.id, submissionId: details.value[t.id].submissionId, examResultId: result.value.id });
      taskState.value[t.id] = { status: "done" };
      result.value = await api.get<Result>(`/exams/results/${route.params.rid}`);
      await loadSubmissions();
    } catch (e) {
      taskState.value[t.id] = { status: "error", error: (e as Error).message };
    }
  }
  running.value = false;
}
const retryable = computed(() => tasks.value.some((t) => taskState.value[t.id]?.status === "error"));
</script>

<template>
  <p v-if="error" class="rounded-2xl bg-bad-bg p-4 text-bad">{{ error }}</p>
  <p v-else-if="!exam || !result" class="text-muted">Even laden…</p>

  <div v-else class="mx-auto grid max-w-3xl gap-6">
    <RouterLink to="/examens" class="text-muted hover:text-ink">← Alle proefexamens</RouterLink>

    <section class="card slide-up p-6 text-center sm:p-8">
      <h1 class="text-2xl font-extrabold">{{ exam.title }}</h1>
      <template v-if="pct !== null && incomplete">
        <p class="mt-3 text-4xl font-extrabold">{{ result.score }} <span class="text-xl font-bold text-muted">van {{ result.max }} punten</span></p>
        <p class="mt-1 font-semibold text-muted">Voorlopige score: nog niet alle teksten zijn beoordeeld. Gebruik het voorbeeld en de checklist, of vraag feedback van Claude.</p>
      </template>
      <template v-else-if="pct !== null">
        <div class="mt-3 text-6xl" aria-hidden="true">{{ passed ? "🎉" : "💪" }}</div>
        <p class="mt-2 text-4xl font-extrabold">{{ result.score }} <span class="text-xl font-bold text-muted">van {{ result.max }}</span></p>
        <p class="mt-1 text-xl font-bold" :class="passed ? 'text-good' : 'text-brand-strong'">{{ pct }}% · {{ passed ? "boven onze oefengrens" : "onder onze oefengrens" }} ({{ Math.round(exam.passScore * 100) }}%)</p>
      </template>
      <p v-else class="mt-3 text-lg text-muted">Er is nog geen score. Hieronder zie je je opdrachten.</p>
      <p class="mt-3 rounded-2xl bg-surface-2 px-4 py-2 text-sm font-semibold text-muted">{{ DISCLAIMER }} DUO publiceert geen vaste grens.</p>
    </section>

    <!-- KNM / Lezen -->
    <template v-if="exam.skill !== 'schrijven'">
      <section v-if="themes.length" class="card p-6">
        <h2 class="mb-3 text-xl font-bold">{{ exam.skill === "knm" ? "Score per thema" : "Score per soort tekst" }}</h2>
        <div class="grid gap-3">
          <div v-for="t in themes" :key="t.tag">
            <div class="flex justify-between text-sm font-bold"><span>{{ t.label }}</span><span>{{ t.good }} / {{ t.total }}</span></div>
            <ProgressBar :value="t.good / t.total" :label="t.label" />
          </div>
        </div>
      </section>

      <section class="card p-6">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 class="text-xl font-bold">{{ wrong.length ? `Fout of niet beantwoord (${wrong.length})` : "Alles goed!" }}</h2>
          <RouterLink v-if="wrong.length" :to="{ path: '/oefenen', query: { exam: result.id } }"><AppButton>Oefen je fouten</AppButton></RouterLink>
        </div>
        <p v-if="!wrong.length" class="font-semibold text-good">✓ Je hebt alle vragen goed beantwoord.</p>
        <ol class="grid gap-4">
          <li v-for="q in wrong" :key="q.id" class="rounded-2xl bg-surface-2 p-4">
            <p class="font-bold">{{ q.exercise.prompt }}</p>
            <p class="mt-1 text-bad">✗ Jouw antwoord: {{ yourAnswer(q) }}</p>
            <p class="text-good">✓ Goed antwoord: {{ correctText(q.exercise) }}</p>
            <p class="mt-1 text-muted">{{ q.exercise.explanation }}</p>
            <div class="mt-1 -ml-3"><ReportIssue :item-id="q.id" /></div>
          </li>
        </ol>
      </section>
    </template>

    <!-- Schrijven -->
    <template v-else>
      <p v-if="running || retryable" class="card p-4 font-semibold" aria-live="polite">
        <template v-if="running">Claude beoordeelt je teksten, een voor een…</template>
        <template v-else>Een beoordeling is niet gelukt. Je teksten zijn opgeslagen.</template>
        <AppButton v-if="retryable && !running" class="ml-3" variant="secondary" @click="runPending">Probeer opnieuw</AppButton>
      </p>
      <p v-if="!settings.hasKey" class="card p-4 text-muted">
        Geen API-sleutel: beoordeel je teksten zelf met het voorbeeld en de checklist. Voeg een sleutel toe bij <RouterLink to="/instellingen" class="font-semibold underline">Instellingen</RouterLink> voor feedback van Claude.
      </p>

      <section v-for="(t, i) in tasks" :key="t.id" class="card p-6">
        <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-xl font-bold">Opdracht {{ i + 1 }}: {{ t.prompt }}</h2>
          <span v-if="typeof details[t.id]?.points === 'number'" class="rounded-full bg-brand-bg px-3 py-1 font-bold text-brand-strong">{{ details[t.id].points }} / {{ details[t.id].max }}</span>
          <span v-else-if="taskState[t.id]?.status === 'busy'" class="flex items-center gap-2 text-sm font-semibold"><span class="h-4 w-4 animate-spin rounded-full border-4 border-line border-t-brand" aria-hidden="true" />Claude leest…</span>
          <span v-else-if="taskState[t.id]?.status === 'wait'" class="text-sm text-muted">Wacht…</span>
        </div>

        <template v-if="t.type === 'form-fill'">
          <ul class="grid gap-1">
            <li v-for="r in fieldRows(t)" :key="r.label" class="flex flex-wrap gap-x-2 rounded-xl px-3 py-1.5" :class="r.ok === true ? 'bg-good-bg' : r.ok === false ? 'bg-bad-bg' : 'bg-surface-2'">
              <span class="font-bold">{{ r.ok === true ? "✓" : r.ok === false ? "✗" : "•" }} {{ r.label }}:</span>
              <span>{{ r.value || "(leeg)" }}</span>
              <span v-if="r.ok === false" class="text-good">→ {{ r.expected }}</span>
            </li>
          </ul>
        </template>

        <template v-else-if="t.type === 'writing'">
          <p v-if="taskState[t.id]?.status === 'error'" class="mb-3 rounded-2xl bg-bad-bg p-3 font-semibold text-bad">✗ {{ taskState[t.id].error }}</p>
          <WritingFeedbackPanel v-if="submissionOf(t.id)?.feedback" :text="submissionOf(t.id)!.text" :feedback="submissionOf(t.id)!.feedback!" />
          <template v-else>
            <div class="rounded-2xl bg-surface-2 p-4">
              <p class="mb-1 font-bold">Jouw tekst</p>
              <p class="whitespace-pre-line text-lg">{{ (result.answers[t.id] as string) || "(niet geschreven)" }}</p>
            </div>
            <details class="mt-3 rounded-2xl border border-line p-4" open>
              <summary class="cursor-pointer font-bold">Voorbeeld en checklist</summary>
              <p class="mt-2 whitespace-pre-line text-lg">{{ t.modelAnswer }}</p>
              <ul class="mt-3 grid gap-1"><li v-for="c in t.checklist" :key="c" class="flex gap-2"><span aria-hidden="true">☐</span>{{ c }}</li></ul>
            </details>
          </template>
        </template>
      </section>
    </template>

    <div class="flex flex-wrap justify-center gap-3">
      <RouterLink to="/examens"><AppButton variant="secondary">Alle proefexamens</AppButton></RouterLink>
      <RouterLink :to="`/examen/${exam.id}`"><AppButton>Opnieuw maken</AppButton></RouterLink>
    </div>
  </div>
</template>
