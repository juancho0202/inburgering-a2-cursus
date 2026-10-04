<script setup lang="ts">
import { computed } from "vue";
import type { WritingFeedback } from "@shared/schemas/claude";
import { buildSegments } from "@shared/logic/corrections";
import ProgressBar from "./ui/ProgressBar.vue";

const props = defineProps<{ text: string; feedback: WritingFeedback }>();

const segments = computed(() => buildSegments(props.text, props.feedback.corrections));
const maxFor = (name: string) => (name === "Opdracht" || name === "Begrijpelijk" ? 3 : name === "Grammatica" || name === "Woorden en spelling" ? 2 : 3);
const verdict = computed(
  () =>
    ({
      voldoende: { label: "Voldoende", icon: "✓", box: "bg-good-bg text-good" },
      bijna: { label: "Bijna voldoende", icon: "≈", box: "bg-brand-bg text-brand-strong" },
      onvoldoende: { label: "Nog niet voldoende", icon: "✗", box: "bg-bad-bg text-bad" },
    })[props.feedback.overall],
);
</script>

<template>
  <div class="grid gap-4">
    <div class="flex flex-wrap items-center gap-4 rounded-2xl p-4" :class="verdict.box">
      <span class="grid h-14 w-14 place-items-center rounded-full bg-surface text-3xl font-extrabold" aria-hidden="true">{{ verdict.icon }}</span>
      <div>
        <p class="text-xl font-extrabold">{{ verdict.label }}</p>
        <p class="font-semibold">Score: {{ Math.round(feedback.score * 10) / 10 }} van 10</p>
      </div>
    </div>

    <section class="card p-5">
      <h3 class="mb-3 font-bold">Beoordeling</h3>
      <div class="grid gap-3">
        <div v-for="c in feedback.criteria" :key="c.name">
          <div class="flex justify-between text-sm font-bold"><span>{{ c.name }}</span><span>{{ c.score }} / {{ maxFor(c.name) }}</span></div>
          <ProgressBar :value="c.score / maxFor(c.name)" :label="c.name" />
          <p class="mt-1 text-muted">{{ c.comment }}</p>
        </div>
      </div>
    </section>

    <section v-if="feedback.missingPoints.length" class="card border-bad p-5">
      <h3 class="mb-2 font-bold text-bad">Dit punt ontbreekt</h3>
      <ul class="grid gap-1"><li v-for="p in feedback.missingPoints" :key="p" class="flex gap-2"><span aria-hidden="true">✗</span>{{ p }}</li></ul>
    </section>

    <section class="card p-5">
      <h3 class="mb-2 font-bold">Jouw tekst met verbeteringen</h3>
      <p class="whitespace-pre-line text-lg leading-relaxed">
        <template v-for="(s, i) in segments" :key="i">
          <span v-if="s.kind === 'text'">{{ s.text }}</span>
          <span v-else>
            <del class="rounded bg-bad-bg px-0.5 text-bad line-through">{{ s.original }}</del>
            <ins class="ml-1 rounded bg-good-bg px-0.5 font-semibold text-good no-underline">{{ s.corrected }}</ins>
          </span>
        </template>
      </p>
      <p v-if="!feedback.corrections.length" class="mt-2 font-semibold text-good">✓ Geen fouten gevonden. Goed gedaan!</p>
    </section>

    <section v-if="feedback.corrections.length" class="card p-5">
      <h3 class="mb-3 font-bold">Uitleg bij de verbeteringen</h3>
      <ol class="grid gap-3">
        <li v-for="(c, i) in feedback.corrections" :key="i" class="rounded-2xl bg-surface-2 p-3">
          <p class="mb-1"><span class="rounded-full bg-brand-bg px-2 py-0.5 text-xs font-bold text-brand-strong">{{ c.type }}</span></p>
          <p><del class="text-bad">{{ c.original }}</del> → <strong class="text-good">{{ c.corrected }}</strong></p>
          <p class="mt-1 text-muted">{{ c.explanation }}</p>
        </li>
      </ol>
    </section>

    <section v-if="feedback.strongPoints.length" class="card p-5">
      <h3 class="mb-2 font-bold text-good">Dit is goed</h3>
      <ul class="grid gap-1"><li v-for="p in feedback.strongPoints" :key="p" class="flex gap-2"><span class="text-good" aria-hidden="true">✓</span>{{ p }}</li></ul>
    </section>

    <section class="rounded-2xl border border-brand/40 bg-brand-bg p-5">
      <h3 class="mb-1 font-bold">💡 Tip voor de volgende keer</h3>
      <p>{{ feedback.nextTip }}</p>
    </section>

    <details class="card p-5">
      <summary class="cursor-pointer font-bold">Je tekst, netjes verbeterd</summary>
      <p class="mt-3 whitespace-pre-line text-lg">{{ feedback.correctedText }}</p>
    </details>
  </div>
</template>
