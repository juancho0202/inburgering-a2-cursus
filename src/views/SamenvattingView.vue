<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "../api/client";
import { h2Headings, renderMdAnchors } from "../composables/markdown";

const md = ref<string | null>(null);
const error = ref<string | null>(null);
onMounted(async () => {
  try {
    md.value = (await api.get<{ md: string }>("/samenvatting")).md;
  } catch (e) {
    error.value = (e as Error).message;
  }
});
const toc = computed(() => (md.value ? h2Headings(md.value) : []));
const html = computed(() => (md.value ? renderMdAnchors(md.value) : ""));
</script>

<template>
  <p v-if="error" class="rounded-2xl bg-bad-bg p-4 text-bad">{{ error }}</p>
  <div v-else-if="md" class="grid gap-6 lg:grid-cols-[14rem_1fr]">
    <nav class="card h-fit p-4 lg:sticky lg:top-20" aria-label="Inhoud">
      <h2 class="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Inhoud</h2>
      <ul class="grid gap-1">
        <li v-for="h in toc" :key="h.id">
          <a :href="`#${h.id}`" class="block rounded-lg px-2 py-1 font-semibold hover:bg-surface-2 hover:text-brand-strong">{{ h.title }}</a>
        </li>
      </ul>
    </nav>
    <article class="card samenvatting p-6 sm:p-8">
      <div class="prose-nl" v-html="html" />
    </article>
  </div>
  <p v-else class="text-muted">Even laden…</p>
</template>
