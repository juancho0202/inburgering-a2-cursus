<script setup lang="ts">
import { computed, ref } from "vue";
import type { Fragment } from "@shared/schemas/content";
import { useFragmentPlayer } from "../composables/useFragmentPlayer";
import { FRAGMENT_LABEL } from "../lib/fragments";
import { formatTime } from "../lib/examLabels";
import ScenePicture from "./ScenePicture.vue";
import ProgressBar from "./ui/ProgressBar.vue";

/**
 * A listening fragment with its play controls. The text is hidden while the learner answers (`showText` false),
 * unless they cannot listen now (`allowPeek`). Shown, each line can be tapped to hear it again, the line being said
 * is highlighted, and `marks` labels lines (e.g. "Vraag 2" where the answer to question 2 is said).
 */
const props = withDefaults(defineProps<{ fragment: Fragment; showText?: boolean; marks?: Record<number, string>; allowPeek?: boolean }>(), {
  showText: false,
  allowPeek: true,
});

const player = useFragmentPlayer(props.fragment);
const { mode, playing, line, progress, time, duration } = player;
const peek = ref(false);
const label = computed(() => FRAGMENT_LABEL[props.fragment.kind]);
const textVisible = computed(() => props.showText || peek.value || mode.value === "none");
// People in a conversation take sides like chat bubbles: the first speaker left, the others right.
const sideOf = (speaker: string) => props.fragment.speakers.findIndex((s) => s.name === speaker);
const conversation = computed(() => props.fragment.speakers.length > 1);
const clock = (seconds: number) => formatTime(seconds * 1000).replace(/^0/, "");

defineExpose({ playFrom: player.playFrom });
</script>

<template>
  <div class="card overflow-hidden">
    <div class="p-5">
      <p class="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
        <span aria-hidden="true" class="text-lg">{{ label.icon }}</span>{{ label.label }}
      </p>
      <p class="mt-2 text-lg">{{ fragment.situation }}</p>
      <ScenePicture v-if="fragment.scene" :id="fragment.scene" class="mt-4 max-w-sm" />

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="inline-flex items-center gap-2 rounded-full bg-brand px-5 py-2.5 text-lg font-bold text-white shadow-card hover:brightness-110 disabled:opacity-50 dark:text-black"
          :aria-pressed="playing"
          :disabled="mode === 'none'"
          @click="player.toggle"
        >
          <span v-if="playing" class="sound-bars" aria-hidden="true"><i /><i /><i /></span>
          <span v-else aria-hidden="true">▶</span>
          {{ playing ? "Pauze" : progress > 0 && progress < 1 ? "Verder" : "Luister" }}
        </button>
        <button
          type="button"
          class="rounded-full border-2 border-line px-3 py-2 font-bold hover:border-brand disabled:opacity-50"
          aria-label="Een zin terug"
          :disabled="mode === 'none'"
          @click="player.back"
        >
          ⟲ Zin terug
        </button>
        <button
          type="button"
          class="rounded-full border-2 border-line px-3 py-2 font-bold hover:border-brand disabled:opacity-50"
          aria-label="Opnieuw vanaf het begin"
          :disabled="mode === 'none'"
          @click="player.restart"
        >
          ⏮ Opnieuw
        </button>
      </div>

      <div v-if="mode === 'recording'" class="mt-4 flex items-center gap-3">
        <input
          type="range"
          min="0"
          :max="duration"
          step="0.1"
          :value="time"
          class="h-2 flex-1 cursor-pointer accent-brand"
          aria-label="Plek in het fragment"
          @input="player.seek(Number(($event.target as HTMLInputElement).value))"
        />
        <span class="shrink-0 text-sm font-semibold tabular-nums text-muted">{{ clock(time) }} / {{ clock(duration) }}</span>
      </div>
      <div v-else-if="mode === 'device'" class="mt-4 flex items-center gap-3">
        <ProgressBar :value="progress" label="Hoe ver het fragment is" />
        <span class="shrink-0 text-sm font-semibold text-muted">{{ line === null ? "" : `Zin ${line + 1} van ${fragment.lines.length}` }}</span>
      </div>
      <p v-else-if="mode === 'none'" class="mt-3 font-semibold text-muted">Dit apparaat kan het fragment niet afspelen. Lees de tekst.</p>

      <button v-if="allowPeek && !textVisible" type="button" class="mt-3 text-sm text-muted underline" @click="peek = true">Ik kan nu niet luisteren</button>
    </div>

    <div v-if="textVisible" class="border-t border-line bg-surface-2/50 p-4">
      <h3 class="mb-2 text-sm font-bold uppercase tracking-wide text-muted">De tekst</h3>
      <ol class="grid gap-2">
        <li v-for="(l, i) in fragment.lines" :key="i" class="flex" :class="conversation && sideOf(l.speaker) > 0 ? 'justify-end' : ''">
          <button
            type="button"
            class="read-along max-w-[90%] rounded-2xl px-4 py-2 text-left"
            :class="[
              { 'is-reading': line === i && playing },
              conversation && sideOf(l.speaker) > 0 ? 'rounded-br-md bg-brand-bg' : 'rounded-bl-md bg-surface',
              marks?.[i] ? 'ring-2 ring-good' : '',
            ]"
            :aria-current="line === i && playing ? 'true' : undefined"
            :aria-label="`Luister vanaf hier: ${l.speaker}: ${l.nl}`"
            @click="player.playFrom(i)"
          >
            <span class="flex flex-wrap items-center gap-2 text-sm font-bold text-muted">
              {{ l.speaker }}
              <span v-if="marks?.[i]" class="rounded-full bg-good-bg px-2 py-0.5 text-xs text-good">✓ {{ marks[i] }}</span>
            </span>
            <span class="block text-lg">{{ l.nl }}</span>
          </button>
        </li>
      </ol>
      <p class="mt-2 text-sm text-muted">Tik op een zin om die nog een keer te horen.</p>
    </div>
  </div>
</template>
