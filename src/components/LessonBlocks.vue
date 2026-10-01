<script setup lang="ts">
import { computed, onMounted } from "vue";
import type { LessonBlock, VocabEntry } from "@shared/types";
import { renderMd } from "../composables/markdown";
import { useVocabStore } from "../stores/vocab";
import DocumentCard from "./DocumentCard.vue";
import SpeakButton from "./ui/SpeakButton.vue";

const props = defineProps<{ blocks: LessonBlock[] }>();
const vocab = useVocabStore();
const needsVocab = computed(() => props.blocks.some((b) => b.kind === "vocab"));
onMounted(() => needsVocab.value && vocab.load());
const word = (id: string): VocabEntry | undefined => vocab.byId(id);
</script>

<template>
  <div class="grid gap-5">
    <template v-for="(block, i) in blocks" :key="i">
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

      <aside v-else-if="block.kind === 'tip'" class="flex gap-3 rounded-2xl border border-brand/40 bg-brand-bg px-4 py-3">
        <span aria-hidden="true" class="text-xl">💡</span>
        <div class="prose-nl" v-html="renderMd(block.md)" />
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
    </template>
  </div>
</template>
