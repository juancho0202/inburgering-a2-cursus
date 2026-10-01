<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../api/client";
import { useVocabStore } from "../stores/vocab";
import AppButton from "../components/ui/AppButton.vue";
import SpeakButton from "../components/ui/SpeakButton.vue";
import { useSpeech } from "../composables/useSpeech";

const vocab = useVocabStore();
const { available, ready } = useSpeech();
const search = ref("");
const article = ref<"" | "de" | "het">("");
const state = ref<"" | "learned" | "open">("");
const message = ref<string | null>(null);

onMounted(() => vocab.load(true));

const q = computed(() => search.value.trim().toLowerCase());
const themes = computed(() =>
  vocab.themes
    .map((t) => ({
      ...t,
      entries: t.entries.filter(
        (e) =>
          (!q.value || e.nl.toLowerCase().includes(q.value) || e.definitionNl.toLowerCase().includes(q.value)) &&
          (!article.value || e.article === article.value) &&
          (!state.value || (state.value === "learned" ? e.state === "learned" : e.state !== "learned")),
      ),
    }))
    .filter((t) => t.entries.length),
);

async function learnTheme(theme: string) {
  const r = await api.post<{ added: number }>("/srs/introduce", { theme });
  message.value = r.added ? `${r.added} nieuwe kaartjes klaar om te herhalen.` : "Je leert deze woorden al.";
  await vocab.load(true);
}
const stateLabel = { new: "Nieuw", learning: "Aan het leren", learned: "Geleerd" } as const;
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 class="text-3xl font-extrabold tracking-tight">Woorden</h1>
      <RouterLink to="/woorden/herhalen"><AppButton>🔤 Woorden herhalen</AppButton></RouterLink>
    </div>
    <p v-if="ready && !available" class="mb-4 rounded-2xl bg-surface-2 px-4 py-2 text-sm text-muted">Je browser heeft geen Nederlandse stem. De 🔊-knoppen staan daarom uit.</p>

    <div class="card mb-6 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto]">
      <label class="block">
        <span class="sr-only">Zoek een woord</span>
        <input v-model="search" type="search" placeholder="Zoek een woord…" class="input" />
      </label>
      <label class="block">
        <span class="sr-only">Lidwoord</span>
        <select v-model="article" class="input"><option value="">de / het</option><option value="de">de</option><option value="het">het</option></select>
      </label>
      <label class="block">
        <span class="sr-only">Status</span>
        <select v-model="state" class="input"><option value="">Alle woorden</option><option value="learned">Geleerd</option><option value="open">Nog niet geleerd</option></select>
      </label>
    </div>

    <p v-if="message" role="status" class="mb-4 rounded-2xl bg-good-bg px-4 py-2 font-semibold text-good">{{ message }}</p>
    <p v-if="vocab.loaded && !themes.length" class="text-muted">Geen woorden gevonden.</p>

    <section v-for="t in themes" :key="t.theme" class="mb-8">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h2 class="text-2xl font-bold">{{ t.title }} <span class="text-base font-semibold text-muted">({{ t.entries.length }})</span></h2>
        <AppButton variant="secondary" @click="learnTheme(t.theme)">Leer dit thema</AppButton>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <article v-for="e in t.entries" :key="e.id" class="card p-4">
          <div class="flex items-center gap-2">
            <h3 class="text-xl font-bold">{{ e.nl }}</h3>
            <SpeakButton :text="e.nl" />
            <span
              class="ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold"
              :class="e.state === 'learned' ? 'bg-good-bg text-good' : e.state === 'learning' ? 'bg-brand-bg text-brand-strong' : 'bg-surface-2 text-muted'"
              >{{ stateLabel[e.state] }}</span
            >
          </div>
          <p v-if="e.plural" class="text-sm text-muted">meervoud: {{ e.plural }}</p>
          <p class="mt-1">{{ e.definitionNl }}</p>
          <p class="mt-1 italic text-muted">{{ e.example }}</p>
        </article>
      </div>
    </section>
  </div>
</template>
