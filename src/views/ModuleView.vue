<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { api } from "../api/client";
import { moduleStyle } from "../lib/moduleStyle";
import { scene } from "../lib/illustrations";
import FadeImage from "../components/ui/FadeImage.vue";
import { useContentStore } from "../stores/content";
import type { Progress } from "@shared/types";
import UiLabel from "../components/ui/UiLabel.vue";
import { useLanguageStore } from "../stores/language";

const route = useRoute();
const content = useContentStore();
const lang = useLanguageStore();
const progress = ref<Progress | null>(null);

onMounted(async () => {
  if (!content.course) await content.load();
  progress.value = await api.get<Progress>("/progress");
});

const mod = computed(() => content.course?.modules.find((m) => m.id === route.params.id));
const style = computed(() => moduleStyle(String(route.params.id)));
const statusOf = (id: string) => progress.value?.units[id];
const recommended = computed(() => mod.value?.units.find((u) => statusOf(u.id)?.status !== "completed")?.id);
</script>

<template>
  <div v-if="mod">
    <RouterLink to="/" class="text-muted hover:text-ink">← <UiLabel k="common.back" /></RouterLink>
    <header class="mb-8 mt-3 flex items-center gap-4">
      <span class="grid h-16 w-16 place-items-center rounded-2xl text-4xl" :class="style.tile" aria-hidden="true">{{ style.emoji }}</span>
      <div lang="nl" translate="no">
        <h1 class="text-3xl font-extrabold tracking-tight">{{ mod.title }}</h1>
        <p class="text-muted">{{ mod.description }}</p>
      </div>
    </header>

    <RouterLink v-if="mod.id === 'schrijven'" to="/schrijven/geschiedenis" class="card mb-6 flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-lg">
      <span class="text-2xl" aria-hidden="true">🗂️</span>
      <span class="font-bold"><UiLabel k="module.myTexts" /></span>
      <span class="ml-auto text-muted">→</span>
    </RouterLink>
    <p v-if="!mod.units.length" class="card p-6 text-muted">{{ lang.t("module.empty") }}</p>
    <ol v-else class="relative grid gap-4 before:absolute before:bottom-6 before:left-[1.65rem] before:top-6 before:w-1 before:rounded-full before:bg-line">
      <li v-for="(u, i) in mod.units" :key="u.id" class="relative">
        <RouterLink :to="`/unit/${u.id}`" class="card group relative flex items-center gap-4 p-4 transition hover:-translate-y-0.5 hover:shadow-lg" :class="{ 'ring-2 ring-brand': u.id === recommended }">
          <span
            class="relative z-10 grid h-12 w-12 shrink-0 place-items-center rounded-full border-4 border-bg text-lg font-extrabold"
            :class="statusOf(u.id)?.status === 'completed' ? 'bg-good text-white dark:text-black' : statusOf(u.id) ? 'bg-brand text-white' : 'bg-surface-2 text-muted'"
          >
            {{ statusOf(u.id)?.status === "completed" ? "✓" : i + 1 }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="flex flex-wrap items-center gap-x-2 text-xs font-bold uppercase tracking-wide text-muted">
              <UiLabel k="settings.lessonN" :params="{ n: i + 1 }" />
              <span v-if="u.id === recommended" class="rounded-full bg-brand-bg px-2 py-0.5 text-brand-strong normal-case tracking-normal"><UiLabel k="common.next" /></span>
            </p>
            <h2 class="text-lg font-bold group-hover:text-brand-strong" lang="nl" translate="no">{{ u.title }}</h2>
            <p class="text-sm text-muted">
              {{ lang.t("module.meta", { min: u.estimatedMinutes, steps: u.stepCount }) }}
              <template v-if="statusOf(u.id)?.status === 'completed'"> · {{ lang.t("module.best", { pct: Math.round((statusOf(u.id)?.bestScore ?? 0) * 100) }) }}</template>
              <template v-else-if="statusOf(u.id)"> · {{ lang.t("module.busy", { n: statusOf(u.id)!.stepIndex + 1 }) }}</template>
            </p>
          </div>
          <span v-if="scene(u.scene)" class="aspect-[3/2] w-20 shrink-0 overflow-hidden rounded-xl border border-line bg-[#fff8ee] sm:w-32" aria-hidden="true">
            <FadeImage :src="scene(u.scene)!.url" alt="" width="480" height="320" class="h-full w-full object-cover dark:brightness-90" />
          </span>
        </RouterLink>
      </li>
    </ol>
  </div>
  <p v-else class="text-muted">{{ lang.t("common.loading") }}</p>
</template>
