<script setup lang="ts">
import { computed, onMounted } from "vue";
import type { LessonBlock, VocabEntry } from "@shared/types";
import { renderMd } from "../composables/markdown";
import { useVocabStore } from "../stores/vocab";
import DocumentCard from "./DocumentCard.vue";
import FragmentPlayer from "./FragmentPlayer.vue";
import ScenePicture from "./ScenePicture.vue";
import SpeakButton from "./ui/SpeakButton.vue";
import UiLabel from "./ui/UiLabel.vue";
import { useLanguageStore } from "../stores/language";
import { APP_WORDS } from "../i18n/glossary";

/** `active`: the block being read aloud (highlighted). */
const props = defineProps<{ blocks: LessonBlock[]; active?: number | null }>();
const vocab = useVocabStore();
const needsVocab = computed(() => props.blocks.some((b) => b.kind === "vocab"));
onMounted(() => needsVocab.value && vocab.load());
const word = (id: string): VocabEntry | undefined => vocab.byId(id);
// Words of the app itself (Unit 0) get their translation from the app's own messages, while the page shows the
// learner's language. The course content stays Dutch only.
const lang = useLanguageStore();
const gloss = (id: string) => (APP_WORDS[id] && lang.proseLocale !== "nl" ? lang.own(APP_WORDS[id]) : null);
</script>

<template>
  <div class="grid gap-5">
    <!-- min-w-0: a wide table scrolls inside its own box instead of stretching the grid (and the page) on phones -->
    <div v-for="(block, i) in blocks" :key="i" class="read-along min-w-0" :class="{ 'is-reading': active === i }">
      <div v-if="block.kind === 'text'" class="prose-nl text-lg" v-html="renderMd(block.md)" />

      <div v-else-if="block.kind === 'table'" class="overflow-x-auto">
        <table class="w-full border-collapse overflow-hidden rounded-2xl text-left">
          <thead>
            <tr>
              <th v-for="h in block.headers" :key="h" class="bg-surface-2 px-4 py-2 font-bold">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, ri) in block.rows" :key="ri" class="border-t border-line">
              <td v-for="(cell, ci) in row" :key="ci" class="px-4 py-2">{{ cell }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- "Leertip": a card with a tab on top, like the tips in the margin of a language book -->
      <aside v-else-if="block.kind === 'tip'" class="mt-3">
        <p class="relative z-10 ml-4 inline-flex items-center gap-1.5 rounded-t-xl border border-b-0 border-brand/40 bg-brand-bg px-3 pt-1 text-sm font-extrabold uppercase tracking-wide text-brand-strong">
          <span aria-hidden="true">💡</span> <UiLabel k="lesson.tip" />
        </p>
        <div class="prose-nl -mt-px rounded-2xl border border-brand/40 bg-brand-bg px-4 py-3" v-html="renderMd(block.md)" />
      </aside>

      <div v-else-if="block.kind === 'example'" class="flex items-center gap-3 rounded-2xl border-l-4 border-good bg-good-bg px-4 py-3">
        <SpeakButton :text="block.nl" />
        <div>
          <p class="text-xl font-semibold">{{ block.nl }}</p>
          <p v-if="block.note" class="text-muted">{{ block.note }}</p>
        </div>
      </div>

      <div v-else-if="block.kind === 'vocab'" class="grid gap-3 sm:grid-cols-2">
        <div v-for="id in block.ids" :key="id" class="card p-4">
          <template v-if="word(id)">
            <div class="flex items-center gap-2">
              <p class="text-xl font-bold">{{ word(id)!.nl }}</p>
              <SpeakButton :text="word(id)!.nl" />
            </div>
            <p v-if="gloss(id)" class="font-semibold text-brand-strong" :lang="lang.locale">{{ gloss(id) }}</p>
            <p class="text-muted">{{ word(id)!.definitionNl }}</p>
            <p class="mt-1 italic">{{ word(id)!.example }}</p>
          </template>
          <p v-else class="text-muted">…</p>
        </div>
      </div>

      <div v-else-if="block.kind === 'dialogue'" class="grid gap-2">
        <div v-for="(line, li) in block.lines" :key="li" class="flex" :class="li % 2 ? 'justify-end' : ''">
          <div class="max-w-[85%] rounded-2xl px-4 py-2.5" :class="li % 2 ? 'rounded-br-md bg-brand-bg' : 'rounded-bl-md bg-surface-2'">
            <p class="text-sm font-bold text-muted">{{ line.speaker }}</p>
            <p class="flex items-center gap-2 text-lg">{{ line.nl }} <SpeakButton :text="line.nl" /></p>
          </div>
        </div>
      </div>

      <DocumentCard v-else-if="block.kind === 'document'" :doc="block" />

      <ScenePicture v-else-if="block.kind === 'picture'" :id="block.scene" :caption="block.caption" class="max-w-xl" />

      <!-- In a lesson the text of a fragment is in view: listen and read along -->
      <FragmentPlayer v-else-if="block.kind === 'fragment'" :fragment="block.fragment" show-text class="max-w-2xl" />
    </div>
  </div>
</template>
