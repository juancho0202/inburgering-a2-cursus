<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { api } from "../api/client";
import type { Exercise } from "@shared/types";
import { useSettingsStore } from "../stores/settings";
import AppButton from "../components/ui/AppButton.vue";
import ProgressBar from "../components/ui/ProgressBar.vue";
import ExerciseShell from "../components/exercises/ExerciseShell.vue";
import type { EvalResult } from "../components/exercises/types";

const route = useRoute();
const router = useRouter();
const settings = useSettingsStore();

const items = ref<Exercise[] | null>(null);
const index = ref(0);
const good = ref(0);
const done = ref(false);
const error = ref<string | null>(null);

// "Meer oefenen met Claude": ?gen=unit&unit=<id> or ?gen=tag&tag=<tag>
const genMode = computed(() => route.query.gen === "unit" || route.query.gen === "tag");
const genType = ref<"mc" | "gap-fill" | "word-order" | "reading">("mc");
const genCount = ref(6);
const generating = ref(false);
const typeOptions = [
  { value: "mc", label: "Meerkeuze" },
  { value: "gap-fill", label: "Invullen" },
  { value: "word-order", label: "Woordvolgorde" },
  { value: "reading", label: "Lezen" },
] as const;

onMounted(async () => {
  if (!settings.settings) await settings.load();
  if (genMode.value) return;
  try {
    const qs = new URLSearchParams(route.query as Record<string, string>).toString();
    items.value = await api.get<Exercise[]>(`/practice?${qs}`);
  } catch (e) {
    error.value = (e as Error).message;
  }
});

async function generate() {
  generating.value = true;
  error.value = null;
  try {
    const body = route.query.gen === "unit" ? { unitId: String(route.query.unit) } : { tag: String(route.query.tag) };
    const res = await api.post<{ exercises: Exercise[] }>("/claude/generate", { ...body, type: genType.value, count: genCount.value });
    items.value = res.exercises;
    index.value = 0;
    good.value = 0;
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    generating.value = false;
  }
}

const title = computed(() =>
  genMode.value
    ? "Oefenen met Claude"
    : route.query.tag
      ? `Oefen: ${String(route.query.tag).replace(":", " · ")}`
      : "Moeilijke vragen",
);

function onDone(r: EvalResult) {
  if (r.correct) good.value++;
  if (index.value + 1 >= (items.value?.length ?? 0)) done.value = true;
  else index.value++;
}
</script>

<template>
  <!-- Setup for Claude-made exercises -->
  <div v-if="genMode && !items" class="mx-auto max-w-xl">
    <div class="card p-6 sm:p-8">
      <h1 class="text-2xl font-extrabold">🤖 Meer oefenen met Claude</h1>
      <template v-if="settings.settings && !settings.hasKey">
        <p class="mt-3 text-muted">Voeg een API-sleutel toe bij Instellingen om nieuwe oefeningen te laten maken. Zonder sleutel kun je de gewone lessen blijven doen.</p>
        <RouterLink to="/instellingen"><AppButton class="mt-4">Naar Instellingen</AppButton></RouterLink>
      </template>
      <template v-else>
        <p class="mt-2 text-muted">Claude maakt nieuwe oefeningen over dit onderwerp. Controleer ze goed: gebruik de knop "Klopt niet" bij een fout.</p>
        <fieldset class="mt-5">
          <legend class="mb-2 font-bold">Soort oefening</legend>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="t in typeOptions"
              :key="t.value"
              type="button"
              class="rounded-2xl border-2 px-3 py-2.5 font-semibold transition"
              :class="genType === t.value ? 'border-brand bg-brand-bg text-brand-strong' : 'border-line hover:border-brand'"
              :aria-pressed="genType === t.value"
              @click="genType = t.value"
            >
              {{ t.label }}
            </button>
          </div>
        </fieldset>
        <label class="mt-4 block font-bold">Aantal ({{ genCount }})
          <input v-model.number="genCount" type="range" min="5" max="10" class="mt-2 w-full accent-[var(--brand)]" />
        </label>
        <p v-if="generating" class="mt-4 flex items-center gap-3 font-semibold" aria-live="polite">
          <span class="h-5 w-5 animate-spin rounded-full border-4 border-line border-t-brand" aria-hidden="true" /> Claude maakt nieuwe oefeningen…
        </p>
        <p v-if="error" class="mt-4 rounded-2xl bg-bad-bg p-3 font-semibold text-bad">✗ {{ error }}</p>
        <AppButton size="lg" class="mt-5 w-full" :disabled="generating" @click="generate">Maak oefeningen</AppButton>
      </template>
      <RouterLink to="/" class="mt-3 block text-center text-muted hover:text-ink">Terug</RouterLink>
    </div>
  </div>

  <p v-else-if="error" class="rounded-2xl bg-bad-bg p-4 text-bad">{{ error }}</p>
  <p v-else-if="!items" class="text-muted">Even laden…</p>

  <div v-else-if="!items.length" class="card mx-auto max-w-xl p-8 text-center">
    <div class="text-5xl" aria-hidden="true">🌟</div>
    <p class="mt-3 text-xl font-bold">Geen vragen om te oefenen. Goed bezig!</p>
    <RouterLink to="/"><AppButton class="mt-5">Terug</AppButton></RouterLink>
  </div>

  <div v-else-if="done" class="card slide-up mx-auto max-w-xl p-8 text-center">
    <div class="text-6xl" aria-hidden="true">🎯</div>
    <h1 class="mt-3 text-3xl font-extrabold">Klaar!</h1>
    <p class="mt-1 text-xl">Je score: <strong>{{ good }} van {{ items.length }}</strong></p>
    <RouterLink to="/"><AppButton size="lg" class="mt-6">Terug naar het begin</AppButton></RouterLink>
  </div>

  <div v-else>
    <div class="mb-6">
      <div class="mb-2 flex justify-between text-sm font-semibold text-muted">
        <span>{{ title }}</span><span>{{ index + 1 }} / {{ items.length }}</span>
      </div>
      <ProgressBar :value="index / items.length" />
    </div>
    <ExerciseShell :key="items[index].id" :exercise="items[index]" :is-last="index + 1 >= items.length" @done="onDone" @exit="router.push('/')" />
  </div>
</template>
