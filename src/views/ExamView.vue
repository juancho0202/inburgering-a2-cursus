<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import type { Exam, Exercise } from "@shared/types";
import { isAnswered } from "@shared/logic/exam";
import { countWords } from "@shared/logic/answers";
import { api } from "../api/client";
import { useSettingsStore } from "../stores/settings";
import AppButton from "../components/ui/AppButton.vue";
import DocumentCard from "../components/DocumentCard.vue";
import McExercise from "../components/exercises/McExercise.vue";
import { DISCLAIMER, formatTime, skillLabel } from "../lib/examLabels";

interface ExamState {
  id: string;
  startedAt: string;
  answers: Record<string, unknown>;
  flagged: string[];
  position: number;
}

const route = useRoute();
const router = useRouter();
const settings = useSettingsStore();

const exam = ref<Exam | null>(null);
const state = ref<ExamState | null>(null);
const error = ref<string | null>(null);
const answers = reactive<Record<string, unknown>>({});
const flagged = ref<string[]>([]);
const position = ref(0);
const now = ref(Date.now());
const confirming = ref(false);
const submitting = ref(false);
const notice = ref<string | null>(null);
const saveFailed = ref(false);
let tick: number | undefined;
let noticeTimer: number | undefined;
let saveTimer: number | undefined;
const warned = new Set<number>();

const items = computed(() => (exam.value?.items.filter((i): i is Exercise => "type" in i) ?? []) as Exercise[]);
const page = computed(() => items.value[position.value]);
const remaining = computed(() => {
  if (!exam.value || !state.value) return 0;
  return Math.max(0, Date.parse(state.value.startedAt) + exam.value.durationMinutes * 60_000 - now.value);
});

onMounted(async () => {
  if (!settings.settings) settings.load();
  try {
    exam.value = await api.get<Exam>(`/exams/${route.params.id}`);
    const res = await api.post<{ result: ExamState; remainingMs: number }>(`/exams/${route.params.id}/start`);
    state.value = res.result;
    Object.assign(answers, res.result.answers);
    flagged.value = res.result.flagged ?? [];
    position.value = Math.min(res.result.position ?? 0, Math.max(0, items.value.length - 1));
    now.value = Date.now();
    if (res.remainingMs <= 0) return submit(true); // time ran out while the learner was away
    tick = window.setInterval(onTick, 1000);
  } catch (e) {
    error.value = (e as Error).message;
  }
});
onBeforeUnmount(() => {
  window.clearInterval(tick);
  window.clearTimeout(noticeTimer);
  window.clearTimeout(saveTimer);
});

function onTick() {
  now.value = Date.now();
  const minutesLeft = remaining.value / 60_000;
  for (const m of [10, 5]) {
    if (minutesLeft <= m && !warned.has(m)) {
      warned.add(m);
      if (minutesLeft > m - 1) show(`Nog ${m} minuten.`);
    }
  }
  if (remaining.value <= 0 && !submitting.value) {
    show("De tijd is om. Je antwoorden worden ingeleverd.");
    submit(true);
  }
}

function show(msg: string) {
  notice.value = msg;
  window.clearTimeout(noticeTimer);
  noticeTimer = window.setTimeout(() => (notice.value = null), 8000);
}

// State is saved continuously, so a refresh resumes at the same question with the remaining time.
function scheduleSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(save, 350);
}
async function save() {
  if (!state.value || submitting.value) return;
  try {
    await api.put(`/exams/results/${state.value.id}/state`, { answers: { ...answers }, flagged: flagged.value, position: position.value });
    saveFailed.value = false;
  } catch {
    saveFailed.value = true;
  }
}
watch([answers, flagged, position], scheduleSave, { deep: true });

// ----- answering -----
const setMc = (id: string, sel: number[]) => (answers[id] = sel);
const initialMc = (id: string) => (Array.isArray(answers[id]) ? (answers[id] as number[]) : []);
const formValues = (item: Extract<Exercise, { type: "form-fill" }>) => {
  if (!Array.isArray(answers[item.id])) answers[item.id] = item.fields.map(() => "");
  return answers[item.id] as string[];
};
const text = (id: string) => (typeof answers[id] === "string" ? (answers[id] as string) : "");

function pageState(item: Exercise): "answered" | "partial" | "open" {
  if (item.type === "mc") return isAnswered(answers[item.id]) ? "answered" : "open";
  if (item.type === "reading") {
    const n = item.questions.filter((q) => isAnswered(answers[q.id])).length;
    return n === item.questions.length ? "answered" : n > 0 ? "partial" : "open";
  }
  if (item.type === "form-fill") return Array.isArray(answers[item.id]) && (answers[item.id] as string[]).some((v) => v.trim()) ? "answered" : "open";
  if (item.type === "writing") return text(item.id).trim() ? "answered" : "open";
  return "open";
}
const unanswered = computed(() => items.value.filter((i) => pageState(i) !== "answered").length);
const isFlagged = (id: string) => flagged.value.includes(id);
const toggleFlag = () => {
  const id = page.value.id;
  flagged.value = isFlagged(id) ? flagged.value.filter((f) => f !== id) : [...flagged.value, id];
};
const go = (i: number) => (position.value = Math.max(0, Math.min(items.value.length - 1, i)));

async function submit(auto = false) {
  if (!state.value || submitting.value) return;
  submitting.value = true;
  window.clearInterval(tick);
  window.clearTimeout(saveTimer);
  try {
    await api.post(`/exams/results/${state.value.id}/submit`, { answers: { ...answers }, flagged: flagged.value, position: position.value });
    router.replace(`/examen/${route.params.id}/resultaat/${state.value.id}`);
  } catch (e) {
    submitting.value = false;
    error.value = (e as Error).message;
    if (auto) tick = window.setInterval(onTick, 1000);
  }
}

function onKey(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || confirming.value) return;
  if (e.key === "ArrowRight") go(position.value + 1);
  if (e.key === "ArrowLeft") go(position.value - 1);
}
onMounted(() => window.addEventListener("keydown", onKey));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
</script>

<template>
  <p v-if="error" class="rounded-2xl bg-bad-bg p-4 text-bad">{{ error }}</p>
  <p v-else-if="!exam || !state" class="text-muted">Even laden…</p>

  <div v-else class="pb-28">
    <!-- top bar -->
    <header class="sticky top-0 z-30 -mx-4 mb-4 border-b border-line bg-surface/95 px-4 py-3 backdrop-blur">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center gap-3">
        <div class="min-w-0 flex-1">
          <p class="truncate font-extrabold">{{ exam.title }}</p>
          <p class="text-xs text-muted">{{ skillLabel[exam.skill] }} · {{ DISCLAIMER }}</p>
        </div>
        <p
          class="rounded-2xl px-4 py-1.5 text-2xl font-extrabold tabular-nums"
          :class="remaining < 5 * 60_000 ? 'bg-bad-bg text-bad' : remaining < 10 * 60_000 ? 'bg-brand-bg text-brand-strong' : 'bg-surface-2'"
          role="timer"
          :aria-label="`Nog ${formatTime(remaining)} minuten`"
        >
          ⏱ {{ formatTime(remaining) }}
        </p>
        <AppButton variant="ghost" @click="router.push('/examens')">Stoppen</AppButton>
      </div>
      <p v-if="notice" role="alert" class="mx-auto mt-2 max-w-6xl rounded-xl bg-brand-bg px-3 py-2 font-bold text-brand-strong">{{ notice }}</p>
      <p v-if="saveFailed" class="mx-auto mt-2 max-w-6xl text-sm font-semibold text-bad">Opslaan lukt niet. Je antwoorden staan nog op dit scherm.</p>
    </header>

    <div class="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1fr_15rem]">
      <!-- question -->
      <section v-if="page" :key="page.id" aria-live="off">
        <p class="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{{ exam.skill === "schrijven" ? "Opdracht" : "Vraag" }} {{ position + 1 }} van {{ items.length }}</p>

        <McExercise v-if="page.type === 'mc'" :exercise="page" :checked="false" :initial="initialMc(page.id)" :shuffle="false" @change="setMc(page.id, $event)" />

        <div v-else-if="page.type === 'reading' && page.document.kind === 'document'" class="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div class="lg:sticky lg:top-28"><DocumentCard :doc="page.document" /></div>
          <div class="grid gap-5">
            <div v-for="(q, i) in page.questions" :key="q.id" class="card p-5">
              <p class="mb-2 text-sm font-bold text-muted">Vraag {{ i + 1 }}</p>
              <McExercise v-if="q.type === 'mc'" :exercise="q" :checked="false" :keys="false" :initial="initialMc(q.id)" :shuffle="false" @change="setMc(q.id, $event)" />
            </div>
          </div>
        </div>

        <div v-else-if="page.type === 'form-fill'">
          <h2 class="mb-3 text-2xl font-bold">{{ page.prompt }}</h2>
          <p class="mb-4 rounded-2xl bg-surface-2 px-4 py-3"><strong>Situatie:</strong> {{ page.scenario }}</p>
          <form class="card overflow-hidden" @submit.prevent>
            <h3 class="border-b border-line bg-surface-2 px-5 py-3 text-lg font-bold">{{ page.formTitle }}</h3>
            <div class="grid gap-4 p-5 sm:grid-cols-2">
              <label v-for="(f, i) in page.fields" :key="i" class="block">
                <span class="text-sm font-bold text-muted">{{ f.label }}</span>
                <input v-model="formValues(page)[i]" autocomplete="off" spellcheck="false" :placeholder="f.hint" class="input mt-1" />
              </label>
            </div>
          </form>
        </div>

        <div v-else-if="page.type === 'writing'">
          <h2 class="mb-3 text-2xl font-bold">{{ page.prompt }}</h2>
          <div class="card mb-4 p-5">
            <p class="font-bold">{{ page.task.instructions }}</p>
            <p class="mt-1 text-muted">{{ page.task.scenario }}</p>
            <ul class="mt-3 grid gap-1"><li v-for="p in page.task.requiredPoints" :key="p" class="flex gap-2"><span class="text-brand" aria-hidden="true">●</span>{{ p }}</li></ul>
          </div>
          <label for="exam-text" class="sr-only">Jouw tekst</label>
          <textarea
            id="exam-text"
            :value="text(page.id)"
            :spellcheck="settings.settings?.spellcheckWriting ?? false"
            rows="10"
            class="input text-lg leading-relaxed"
            placeholder="Schrijf hier je tekst…"
            @input="answers[page.id] = ($event.target as HTMLTextAreaElement).value"
          />
          <p class="mt-1 text-sm font-semibold text-muted" aria-live="polite">{{ countWords(text(page.id)) }} woorden (tussen {{ page.minWords }} en {{ page.maxWords }})</p>
        </div>
      </section>

      <!-- navigator -->
      <nav class="card h-fit p-4 lg:sticky lg:top-28" aria-label="Vragenlijst">
        <h2 class="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Overzicht</h2>
        <ol class="grid grid-cols-5 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
          <li v-for="(it, i) in items" :key="it.id">
            <button
              type="button"
              class="relative grid h-10 w-full place-items-center rounded-xl border-2 text-sm font-bold transition"
              :class="[
                i === position ? 'border-brand ring-2 ring-brand/40' : 'border-line',
                pageState(it) === 'answered' ? 'bg-good-bg text-good' : pageState(it) === 'partial' ? 'bg-brand-bg text-brand-strong' : 'bg-surface',
              ]"
              :aria-label="`${exam.skill === 'schrijven' ? 'Opdracht' : 'Vraag'} ${i + 1}: ${pageState(it) === 'answered' ? 'beantwoord' : pageState(it) === 'partial' ? 'half beantwoord' : 'open'}${isFlagged(it.id) ? ', gemarkeerd' : ''}`"
              :aria-current="i === position ? 'step' : undefined"
              @click="go(i)"
            >
              {{ i + 1 }}
              <span v-if="isFlagged(it.id)" class="absolute -right-1 -top-1 text-xs" aria-hidden="true">⚑</span>
            </button>
          </li>
        </ol>
        <ul class="mt-3 grid gap-1 text-xs text-muted">
          <li><span class="font-bold text-good">✓</span> beantwoord (groen)</li>
          <li><span class="font-bold text-brand-strong">◐</span> half beantwoord (oranje)</li>
          <li>⚑ gemarkeerd · wit = open</li>
        </ul>
      </nav>
    </div>

    <!-- bottom bar -->
    <div class="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur">
      <div class="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div class="flex gap-2">
          <AppButton variant="secondary" :disabled="position === 0" @click="go(position - 1)">← Vorige</AppButton>
          <AppButton variant="secondary" :disabled="position >= items.length - 1" @click="go(position + 1)">Volgende →</AppButton>
        </div>
        <div class="flex gap-2">
          <AppButton v-if="page" :variant="isFlagged(page.id) ? 'primary' : 'secondary'" @click="toggleFlag">⚑ {{ isFlagged(page.id) ? "Markering weg" : "Markeer" }}</AppButton>
          <AppButton variant="good" @click="confirming = true">Inleveren</AppButton>
        </div>
      </div>
    </div>

    <!-- confirm -->
    <div v-if="confirming" class="fixed inset-0 z-40 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-title" @keydown.esc="confirming = false">
      <div class="card w-full max-w-md p-6">
        <h2 id="confirm-title" class="text-2xl font-extrabold">Examen inleveren?</h2>
        <p class="mt-2">
          <template v-if="unanswered"><strong class="text-bad">{{ unanswered }}</strong> {{ unanswered === 1 ? "onderdeel is" : "onderdelen zijn" }} nog niet (helemaal) beantwoord.</template>
          <template v-else>Je hebt alles beantwoord.</template>
          Na het inleveren kun je niets meer veranderen.
        </p>
        <div class="mt-5 flex flex-wrap justify-end gap-3">
          <AppButton variant="secondary" @click="confirming = false">Terug naar het examen</AppButton>
          <AppButton variant="good" :disabled="submitting" @click="submit()">{{ submitting ? "Bezig…" : "Ja, inleveren" }}</AppButton>
        </div>
      </div>
    </div>
  </div>
</template>
