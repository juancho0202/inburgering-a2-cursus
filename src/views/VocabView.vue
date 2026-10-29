<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../api/client";
import { useVocabStore } from "../stores/vocab";
import AppButton from "../components/ui/AppButton.vue";
import SpeakButton from "../components/ui/SpeakButton.vue";
import { useSpeech } from "../composables/useSpeech";
import UiLabel from "../components/ui/UiLabel.vue";
import { useLanguageStore } from "../stores/language";

const vocab = useVocabStore();
const lang = useLanguageStore();
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
  message.value = r.added ? lang.t("vocab.added", { n: r.added }, r.added) : lang.t("vocab.already");
  await vocab.load(true);
}
const stateLabel = { new: "vocab.new", learning: "vocab.learning", learned: "vocab.learned" } as const;
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 class="text-3xl font-extrabold tracking-tight"><UiLabel variant="heading" k="nav.words" /></h1>
      <RouterLink to="/woorden/herhalen"><AppButton>📕 <UiLabel k="review.title" /></AppButton></RouterLink>
    </div>
    <p v-if="ready && !available" class="mb-4 rounded-2xl bg-surface-2 px-4 py-2 text-sm text-muted">{{ lang.t("vocab.noVoice") }}</p>

    <div class="card mb-6 grid gap-3 p-4 sm:grid-cols-[1fr_auto_auto]">
      <label class="block">
        <span class="sr-only">{{ lang.t("vocab.search") }}</span>
        <input v-model="search" type="search" :placeholder="lang.t('vocab.searchPlaceholder')" class="input" />
      </label>
      <label class="block">
        <span class="sr-only">{{ lang.t("vocab.article") }}</span>
        <select v-model="article" class="input"><option value="">de / het</option><option value="de">de</option><option value="het">het</option></select>
      </label>
      <label class="block">
        <span class="sr-only">{{ lang.t("vocab.status") }}</span>
        <select v-model="state" class="input">
          <option value="">{{ lang.t("vocab.all") }}</option><option value="learned">{{ lang.t("vocab.learned") }}</option><option value="open">{{ lang.t("vocab.open") }}</option>
        </select>
      </label>
    </div>

    <p v-if="message" role="status" class="mb-4 rounded-2xl bg-good-bg px-4 py-2 font-semibold text-good">{{ message }}</p>
    <p v-if="vocab.loaded && !themes.length" class="text-muted">{{ lang.t("vocab.none") }}</p>

    <section v-for="t in themes" :key="t.theme" class="mb-8">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-2xl font-bold"><span lang="nl" translate="no">{{ t.title }}</span> <span class="text-base font-semibold text-muted">({{ t.entries.length }})</span></h2>
        <AppButton variant="secondary" @click="learnTheme(t.theme)"><UiLabel k="vocab.learnTheme" /></AppButton>
      </div>
      <!-- minmax(0, 1fr): a card can shrink to the screen instead of growing to its longest word -->
      <div class="grid grid-cols-[minmax(0,1fr)] gap-3 sm:grid-cols-[repeat(2,minmax(0,1fr))]">
        <article v-for="e in t.entries" :key="e.id" class="card break-words p-4" lang="nl">
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="min-w-0 text-xl font-bold">{{ e.nl }}</h3>
            <SpeakButton :text="e.nl" />
            <span
              class="ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold"
              :class="e.state === 'learned' ? 'bg-good-bg text-good' : e.state === 'learning' ? 'bg-brand-bg text-brand-strong' : 'bg-surface-2 text-muted'"
              ><UiLabel variant="inline" :k="stateLabel[e.state]" /></span
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
