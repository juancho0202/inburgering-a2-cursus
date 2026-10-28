<script setup lang="ts">
import { useRoute } from "vue-router";
import { dismissUpdate, installUpdate, updateReady } from "../lib/appUpdate";
import { useLanguageStore } from "../stores/language";
import UiLabel from "./ui/UiLabel.vue";

const route = useRoute();
const lang = useLanguageStore();
</script>

<template>
  <!-- Not during an exam (focus mode): it would distract, and the offer is still there afterwards. -->
  <div v-if="updateReady && !route.meta.focus" role="status" class="fixed inset-x-0 bottom-0 z-40 p-3 sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm">
    <!-- Text on top, buttons under it: side by side the text was squeezed into a narrow column on a phone -->
    <div class="grid gap-3 rounded-2xl border border-line bg-surface p-4 shadow-2xl">
      <p class="font-semibold"><span aria-hidden="true">✨ </span>{{ lang.t("update.ready") }}</p>
      <div class="flex justify-end gap-2">
        <button type="button" class="rounded-xl px-3 py-2 font-semibold text-muted transition hover:bg-surface-2 hover:text-ink" @click="dismissUpdate"><UiLabel k="update.later" /></button>
        <button type="button" class="rounded-xl bg-brand px-4 py-2 font-bold text-white transition hover:opacity-90" @click="installUpdate"><UiLabel k="update.now" /></button>
      </div>
    </div>
  </div>
</template>
