<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { Exercise } from "@shared/types";
import { api } from "../../api/client";
import AppButton from "../ui/AppButton.vue";
import ExerciseRenderer from "./ExerciseRenderer.vue";
import type { EvalResult } from "./types";

const props = defineProps<{ exercise: Exercise; isLast?: boolean }>();
const emit = defineEmits<{ done: [result: EvalResult]; exit: [] }>();

const renderer = ref<InstanceType<typeof ExerciseRenderer> | null>(null);
const result = ref<EvalResult | null>(null);
const saveError = ref<string | null>(null);
const startedAt = Date.now();
const checked = computed(() => result.value !== null);
const ready = computed(() => renderer.value?.ready ?? false);

const praise = ["Goed zo!", "Helemaal goed.", "Prima!"];
const headline = computed(() => {
  const r = result.value;
  if (!r) return "";
  if (r.score === null) return "Klaar! Vergelijk met het voorbeeld.";
  if (r.correct) return praise[Math.floor(Math.random() * praise.length)];
  return r.correctAnswer ? "Bijna. Het goede antwoord is:" : "Niet helemaal goed. Kijk naar de uitleg.";
});

async function check() {
  if (checked.value || !ready.value || !renderer.value) return;
  const r = renderer.value.evaluate();
  result.value = r;
  const durationMs = Date.now() - startedAt;
  const items = r.parts ?? [{ itemId: props.exercise.id, correct: r.correct, answer: r.answer }];
  try {
    // Every answer is saved immediately.
    await Promise.all(
      items.map((p) =>
        api.post("/attempts", {
          itemId: p.itemId,
          exerciseType: props.exercise.type,
          correct: p.correct,
          answer: p.answer ?? null,
          durationMs: Math.round(durationMs / items.length),
        }),
      ),
    );
  } catch (err) {
    saveError.value = (err as Error).message;
  }
}

function next() {
  if (result.value) emit("done", result.value);
}

function onKey(e: KeyboardEvent) {
  if (e.key === "Escape") return emit("exit");
  if (e.key !== "Enter" || e.target instanceof HTMLTextAreaElement) return;
  e.preventDefault();
  if (checked.value) next();
  else check();
}
onMounted(() => window.addEventListener("keydown", onKey, true));
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));
</script>

<template>
  <div class="pb-44">
    <ExerciseRenderer ref="renderer" :exercise="exercise" :checked="checked" />

    <div class="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 backdrop-blur" role="region" aria-label="Controle">
      <div v-if="result" role="status" aria-live="polite" class="slide-up border-b border-line" :class="result.score === null ? 'bg-surface-2' : result.correct ? 'bg-good-bg' : 'bg-bad-bg'">
        <div class="mx-auto max-w-4xl px-4 py-3">
          <p class="flex flex-wrap items-baseline gap-x-2 text-lg font-bold" :class="result.score === null ? '' : result.correct ? 'text-good' : 'text-bad'">
            <span aria-hidden="true">{{ result.score === null ? "📝" : result.correct ? "✓" : "✗" }}</span>
            {{ headline }}
            <span v-if="!result.correct && result.correctAnswer && result.score !== null" class="text-ink">{{ result.correctAnswer }}</span>
          </p>
          <p v-if="exercise.explanation" class="mt-1">{{ exercise.explanation }}</p>
          <p v-if="saveError" class="mt-1 text-sm text-bad">{{ saveError }}</p>
        </div>
      </div>
      <div class="mx-auto flex max-w-4xl items-center justify-between gap-3 px-4 py-3">
        <AppButton variant="ghost" @click="emit('exit')">Stoppen</AppButton>
        <AppButton v-if="!checked" size="lg" :disabled="!ready" @click="check">Controleer</AppButton>
        <AppButton v-else size="lg" :variant="result!.score === null || result!.correct ? 'good' : 'primary'" @click="next">
          {{ isLast ? "Afronden" : "Volgende" }} →
        </AppButton>
      </div>
    </div>
  </div>
</template>
