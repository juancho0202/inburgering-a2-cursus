<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { api } from "../api/client";
import { moduleStyle } from "../lib/moduleStyle";
import { useContentStore } from "../stores/content";
import type { Progress } from "@shared/types";

const route = useRoute();
const content = useContentStore();
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
    <RouterLink to="/" class="text-muted hover:text-ink">← Terug</RouterLink>
    <header class="mb-8 mt-3 flex items-center gap-4">
      <span class="grid h-16 w-16 place-items-center rounded-2xl text-4xl" :class="style.tile" aria-hidden="true">{{ style.emoji }}</span>
      <div>
        <h1 class="text-3xl font-extrabold tracking-tight">{{ mod.title }}</h1>
        <p class="text-muted">{{ mod.description }}</p>
      </div>
    </header>

    <p v-if="!mod.units.length" class="card p-6 text-muted">Hier komen later lessen. Kom snel terug!</p>
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
            <h2 class="text-lg font-bold group-hover:text-brand-strong">{{ u.title }}</h2>
            <p class="text-sm text-muted">
              {{ u.estimatedMinutes }} min · {{ u.stepCount }} stappen
              <template v-if="statusOf(u.id)?.status === 'completed'"> · beste score {{ Math.round((statusOf(u.id)?.bestScore ?? 0) * 100) }}%</template>
              <template v-else-if="statusOf(u.id)"> · bezig (stap {{ statusOf(u.id)!.stepIndex + 1 }})</template>
            </p>
          </div>
          <span v-if="u.id === recommended" class="rounded-full bg-brand-bg px-3 py-1 text-sm font-bold text-brand-strong">Volgende</span>
        </RouterLink>
      </li>
    </ol>
  </div>
  <p v-else class="text-muted">Even laden…</p>
</template>
