<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../api/client";
import type { WritingFeedback } from "@shared/schemas/claude";
import WritingFeedbackPanel from "../components/WritingFeedbackPanel.vue";
import { countWords } from "@shared/logic/answers";

interface Row {
  id: string;
  exerciseId: string;
  text: string;
  submittedAt: string;
  feedback: WritingFeedback | null;
  task: { prompt: string; scenario: string; register: string; type: string } | null;
}

const rows = ref<Row[] | null>(null);
const error = ref<string | null>(null);
const filter = ref("");
const open = ref<string | null>(null);

onMounted(async () => {
  try {
    rows.value = await api.get<Row[]>("/writing");
  } catch (e) {
    error.value = (e as Error).message;
  }
});

const labels: Record<string, string> = { "kort-bericht": "Kort bericht", informeel: "Informele e-mail", formeel: "Formele e-mail", overig: "Overig" };
const shown = computed(() => (rows.value ?? []).filter((r) => !filter.value || (r.task?.type ?? "overig") === filter.value));
const fmt = (iso: string) => new Date(iso).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" });
const verdict = { voldoende: "bg-good-bg text-good", bijna: "bg-brand-bg text-brand-strong", onvoldoende: "bg-bad-bg text-bad" } as const;
</script>

<template>
  <div>
    <RouterLink to="/module/schrijven" class="text-muted hover:text-ink">← Terug</RouterLink>
    <div class="mb-6 mt-3 flex flex-wrap items-end justify-between gap-3">
      <h1 class="text-3xl font-extrabold tracking-tight">Mijn teksten</h1>
      <label class="block">
        <span class="sr-only">Soort opdracht</span>
        <select v-model="filter" class="input !w-auto">
          <option value="">Alle opdrachten</option>
          <option v-for="(label, key) in labels" :key="key" :value="key">{{ label }}</option>
        </select>
      </label>
    </div>

    <p v-if="error" class="rounded-2xl bg-bad-bg p-4 text-bad">{{ error }}</p>
    <p v-else-if="!rows" class="text-muted">Even laden…</p>
    <p v-else-if="!shown.length" class="card p-6 text-muted">Nog geen teksten. Schrijf je eerste tekst bij een les van Schrijven.</p>

    <ul v-else class="grid gap-3">
      <li v-for="r in shown" :key="r.id" class="card p-4">
        <button type="button" class="flex w-full flex-wrap items-center gap-3 text-left" :aria-expanded="open === r.id" @click="open = open === r.id ? null : r.id">
          <div class="min-w-0 flex-1">
            <p class="font-bold">{{ r.task?.prompt ?? r.exerciseId }}</p>
            <p class="text-sm text-muted">{{ fmt(r.submittedAt) }} · {{ labels[r.task?.type ?? "overig"] }} · {{ countWords(r.text) }} woorden</p>
          </div>
          <span v-if="r.feedback" class="rounded-full px-3 py-1 text-sm font-bold" :class="verdict[r.feedback.overall]">{{ r.feedback.overall }} · {{ Math.round(r.feedback.score) }}/10</span>
          <span v-else class="rounded-full bg-surface-2 px-3 py-1 text-sm font-semibold text-muted">geen feedback</span>
          <span aria-hidden="true">{{ open === r.id ? "▲" : "▼" }}</span>
        </button>
        <div v-if="open === r.id" class="slide-up mt-4 grid gap-4">
          <WritingFeedbackPanel v-if="r.feedback" :text="r.text" :feedback="r.feedback" />
          <div v-else class="rounded-2xl bg-surface-2 p-4">
            <p class="mb-2 font-bold">Jouw tekst</p>
            <p class="whitespace-pre-line text-lg">{{ r.text }}</p>
          </div>
        </div>
      </li>
    </ul>
  </div>
</template>
