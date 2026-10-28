<script setup lang="ts">
import { useRoute } from "vue-router";
import { dismissUpdate, installUpdate, updateReady } from "../lib/appUpdate";

const route = useRoute();
</script>

<template>
  <!-- Not during an exam (focus mode): it would distract, and the offer is still there afterwards. -->
  <div v-if="updateReady && !route.meta.focus" role="status" class="fixed inset-x-0 bottom-0 z-40 p-3 sm:bottom-4 sm:left-auto sm:right-4 sm:max-w-sm">
    <div class="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-2xl">
      <p class="flex-1 font-semibold"><span aria-hidden="true">✨ </span>Er is een nieuwe versie van de app.</p>
      <div class="flex gap-2">
        <button type="button" class="rounded-xl px-3 py-2 font-semibold text-muted transition hover:bg-surface-2 hover:text-ink" @click="dismissUpdate">Later</button>
        <button type="button" class="rounded-xl bg-brand px-4 py-2 font-bold text-white transition hover:opacity-90" @click="installUpdate">Nu vernieuwen</button>
      </div>
    </div>
  </div>
</template>
