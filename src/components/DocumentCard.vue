<script setup lang="ts">
import { computed } from "vue";
import type { LessonBlock } from "@shared/types";

type Doc = Extract<LessonBlock, { kind: "document" }>;
const props = defineProps<{ doc: Doc }>();

const labels: Record<Doc["docType"], string> = {
  brief: "Brief",
  email: "E-mail",
  advertentie: "Advertentie",
  formulier: "Formulier",
  bericht: "Bericht",
  rooster: "Rooster",
  folder: "Folder",
};

/** "Key: value" header lines at the top of the body become a header table. */
const parsed = computed(() => {
  const lines = props.doc.body.split("\n");
  const head: [string, string][] = [];
  let i = 0;
  for (; i < lines.length; i++) {
    const m = /^(Van|Aan|Datum|Onderwerp|Plaats|Prijs|Tel|Contact):\s*(.+)$/.exec(lines[i]);
    if (!m) break;
    head.push([m[1], m[2]]);
  }
  return { head, body: lines.slice(i).join("\n").trim() };
});
// Body segments: lines with " | " form a table, other lines form paragraphs (for roosters).
type Segment = { kind: "text"; text: string } | { kind: "table"; rows: string[][] };
const segments = computed<Segment[]>(() => {
  const out: Segment[] = [];
  for (const line of parsed.value.body.split("\n")) {
    if (line.includes(" | ")) {
      const row = line.split(" | ").map((c) => c.trim());
      const last = out[out.length - 1];
      if (last?.kind === "table") last.rows.push(row);
      else out.push({ kind: "table", rows: [row] });
    } else {
      const last = out[out.length - 1];
      if (last?.kind === "text") last.text += "\n" + line;
      else out.push({ kind: "text", text: line });
    }
  }
  return out.map((s) => (s.kind === "text" ? { ...s, text: s.text.trim() } : s)).filter((s) => s.kind === "table" || s.text);
});
</script>

<template>
  <article
    class="overflow-hidden rounded-2xl border border-line bg-white text-slate-900 shadow-card"
    :class="{
      'border-2 border-dashed border-amber-500 bg-amber-50': doc.docType === 'advertentie',
      'font-mono': doc.docType === 'bericht',
    }"
  >
    <header class="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-100 px-5 py-2.5">
      <span class="text-sm font-bold uppercase tracking-wide text-slate-500">{{ labels[doc.docType] }}</span>
      <span class="truncate text-base font-bold">{{ doc.title }}</span>
    </header>
    <div class="px-5 py-4">
      <dl v-if="parsed.head.length" class="mb-3 grid grid-cols-[auto_1fr] gap-x-4 border-b border-slate-200 pb-3 text-base">
        <template v-for="[k, v] in parsed.head" :key="k">
          <dt class="font-semibold text-slate-500">{{ k }}:</dt>
          <dd>{{ v }}</dd>
        </template>
      </dl>
      <template v-for="(seg, si) in segments" :key="si">
        <div v-if="seg.kind === 'table'" class="my-3 overflow-x-auto">
          <table class="w-full border-collapse text-left">
            <tbody>
              <tr v-for="(row, ri) in seg.rows" :key="ri" :class="ri === 0 ? 'bg-slate-100 font-bold' : 'border-t border-slate-200'">
                <td v-for="(cell, ci) in row" :key="ci" class="px-3 py-2">{{ cell }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="whitespace-pre-line text-lg leading-relaxed">{{ seg.text }}</p>
      </template>
    </div>
  </article>
</template>
