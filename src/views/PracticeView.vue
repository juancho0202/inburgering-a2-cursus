<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRoute, useRouter, RouterLink } from "vue-router";
import { api } from "../api/client";
import type { Exercise } from "@shared/types";
import AppButton from "../components/ui/AppButton.vue";
import ProgressBar from "../components/ui/ProgressBar.vue";
import ExerciseShell from "../components/exercises/ExerciseShell.vue";
import type { EvalResult } from "../components/exercises/types";

const route = useRoute();
const router = useRouter();
const items = ref<Exercise[] | null>(null);
const index = ref(0);
const good = ref(0);
const done = ref(false);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const qs = new URLSearchParams(route.query as Record<string, string>).toString();
    items.value = await api.get<Exercise[]>(`/practice?${qs}`);
  } catch (e) {
    error.value = (e as Error).message;
  }
});

const title = computed(() => (route.query.tag ? `Oefen: ${String(route.query.tag).replace(":", " · ")}` : "Moeilijke vragen"));

function onDone(r: EvalResult) {
  if (r.correct) good.value++;
  if (index.value + 1 >= (items.value?.length ?? 0)) done.value = true;
  else index.value++;
}
</script>

<template>
  <p v-if="error" class="rounded-2xl bg-bad-bg p-4 text-bad">{{ error }}</p>
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
    <ExerciseShell :key="index" :exercise="items[index]" :is-last="index + 1 >= items.length" @done="onDone" @exit="router.push('/')" />
  </div>
</template>
