<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { api } from "../api/client";
import { useVerbsStore } from "../stores/verbs";
import AppButton from "../components/ui/AppButton.vue";
import SpeakButton from "../components/ui/SpeakButton.vue";
import UiLabel from "../components/ui/UiLabel.vue";
import { useLanguageStore } from "../stores/language";

const verbs = useVerbsStore();
const lang = useLanguageStore();
const router = useRouter();
const search = ref("");
const separable = ref(false);
const irregular = ref(false);

onMounted(() => verbs.load());

const rows = computed(() =>
  verbs.verbs.filter(
    (v) =>
      (!search.value.trim() || v.infinitive.includes(search.value.trim().toLowerCase())) &&
      (!separable.value || v.separable) &&
      (!irregular.value || v.irregular),
  ),
);

async function practise() {
  await api.post("/srs/introduce", { verbs: true });
  router.push({ path: "/woorden/herhalen", query: { kind: "verb" } });
}
</script>

<template>
  <div>
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 class="text-3xl font-extrabold tracking-tight"><UiLabel k="nav.verbs" /></h1>
      <AppButton @click="practise">🔁 <UiLabel k="verbs.practise" /></AppButton>
    </div>

    <div class="card mb-6 flex flex-wrap items-center gap-4 p-4">
      <label class="block min-w-48 flex-1">
        <span class="sr-only">{{ lang.t("verbs.search") }}</span>
        <input v-model="search" type="search" :placeholder="lang.t('verbs.searchPlaceholder')" class="input" />
      </label>
      <label class="flex items-center gap-2 font-semibold"><input v-model="separable" type="checkbox" class="h-5 w-5 accent-[var(--brand)]" /> <UiLabel k="verbs.separable" /></label>
      <label class="flex items-center gap-2 font-semibold"><input v-model="irregular" type="checkbox" class="h-5 w-5 accent-[var(--brand)]" /> <UiLabel k="verbs.irregular" /></label>
    </div>

    <div class="card overflow-x-auto">
      <table class="w-full min-w-[40rem] border-collapse text-left">
        <thead class="bg-surface-2 text-sm uppercase tracking-wide text-muted">
          <tr>
            <th class="px-4 py-3"><UiLabel k="exercise.verb" /></th>
            <th class="px-4 py-3">ik / jij / hij</th>
            <th class="px-4 py-3">wij</th>
            <th class="px-4 py-3"><UiLabel k="verbs.past" /></th>
            <th class="px-4 py-3"><UiLabel k="review.participle" /></th>
          </tr>
        </thead>
        <tbody lang="nl" translate="no">
          <tr v-for="v in rows" :key="v.id" class="border-t border-line align-top">
            <td class="px-4 py-3">
              <div class="flex items-center gap-2 font-bold">{{ v.infinitive }} <SpeakButton :text="v.infinitive" /></div>
              <div class="mt-1 flex gap-1.5 text-xs font-bold">
                <span v-if="v.separable" class="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700 dark:bg-sky-950 dark:text-sky-300">scheidbaar</span>
                <span v-if="v.irregular" class="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-950 dark:text-amber-300">onregelmatig</span>
              </div>
            </td>
            <td class="px-4 py-3">{{ v.present.ik }} / {{ v.present.jij }} / {{ v.present.hij }}</td>
            <td class="px-4 py-3">{{ v.present.wij }}</td>
            <td class="px-4 py-3">{{ v.past.sg }} / {{ v.past.pl }}</td>
            <td class="px-4 py-3">{{ v.auxiliary === "both" ? "heeft/is" : v.auxiliary === "zijn" ? "is" : "heeft" }} {{ v.participle }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
