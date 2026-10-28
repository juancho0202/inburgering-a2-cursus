<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { api } from "../api/client";
import { h2Headings, renderMdAnchors } from "../composables/markdown";
import UiLabel from "../components/ui/UiLabel.vue";
import { useLanguageStore } from "../stores/language";

const lang = useLanguageStore();
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

// On a phone the table of contents is a bar that sticks under the header; it folds up once a section is chosen,
// so the text is not hidden behind it. On a wide screen it is a sidebar that is always open.
const tocOpen = ref(true);
// Scrolled by hand: a plain "#id" link goes through the router, whose scrollBehavior sends every navigation to the top.
async function goTo(id: string) {
  tocOpen.value = false;
  await nextTick(); // fold first, so the heading lands where it will stay
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}
</script>

<template>
  <p v-if="error" class="rounded-2xl bg-bad-bg p-4 text-bad">{{ error }}</p>
  <!-- minmax(0, 1fr): a wide table scrolls inside the card instead of stretching the page past the screen -->
  <div v-else-if="md" class="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[14rem_minmax(0,1fr)]">
    <!-- Phone and tablet: a full-width bar right under the header (the negative margins undo the page padding).
         Wide screen: a card in the sidebar. -->
    <nav
      class="card sticky top-[72px] z-20 -mx-4 -mt-6 h-fit rounded-none border-x-0 border-t-0 px-4 py-2 sm:-mt-8 lg:top-24 lg:mx-0 lg:mt-0 lg:rounded-card lg:border-x lg:border-t lg:p-4"
      :aria-label="lang.t('summary.contents')"
    >
      <button
        type="button"
        class="flex w-full items-center justify-between rounded-lg px-2 py-2 text-sm font-bold uppercase tracking-wide text-muted lg:hidden"
        :aria-expanded="tocOpen"
        aria-controls="inhoud-lijst"
        @click="tocOpen = !tocOpen"
      >
        <UiLabel k="summary.contents" /> <span aria-hidden="true" class="transition-transform" :class="tocOpen && 'rotate-180'">▾</span>
      </button>
      <h2 class="mb-2 hidden text-sm font-bold uppercase tracking-wide text-muted lg:block"><UiLabel k="summary.contents" /></h2>
      <ul id="inhoud-lijst" lang="nl" translate="no" class="max-h-[60vh] gap-1 overflow-y-auto lg:grid lg:max-h-none" :class="tocOpen ? 'grid' : 'hidden'">
        <li v-for="h in toc" :key="h.id">
          <a :href="`#${h.id}`" class="block rounded-lg px-2 py-1 font-semibold hover:bg-surface-2 hover:text-brand-strong" @click.prevent="goTo(h.id)">{{ h.title }}</a>
        </li>
      </ul>
    </nav>
    <article class="card samenvatting p-6 sm:p-8" lang="nl" translate="no">
      <div class="prose-nl" v-html="html" />
    </article>
  </div>
  <p v-else class="text-muted">{{ lang.t("common.loading") }}</p>
</template>
