<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { api } from "../api/client";
import type { ProgressFile } from "@shared/schemas/transfer";
import { useSessionStore } from "../stores/session";
import { canShareFile, makeProgressFile, progressFileName, saveProgressFile } from "../lib/progressFile";
import AppButton from "./ui/AppButton.vue";
import UiLabel from "./ui/UiLabel.vue";
import UiText from "./ui/UiText.vue";
import { useLanguageStore } from "../stores/language";

interface Summary {
  minutesToday: number;
  answersToday: number;
  correctToday: number;
  unitsCompletedToday: number;
  unsavedAnswers: number;
  lastExportAt: string | null;
  deviceName: string | null;
}

const session = useSessionStore();
const lang = useLanguageStore();
const summary = ref<Summary | null>(null);
const deviceName = ref("");
const file = ref<File | null>(null);
const message = ref<{ ok: boolean; text: string } | null>(null);
const busy = ref(false);
const dialog = ref<HTMLElement | null>(null);

// The file is made when the dialog opens, so the "Bewaar" click can share it right away
// (browsers only allow sharing straight from a click).
async function prepare() {
  const [s, bundle] = await Promise.all([api.get<Summary>("/session/summary"), api.get<ProgressFile>("/export")]);
  summary.value = s;
  deviceName.value = s.deviceName ?? "";
  file.value = makeProgressFile(bundle, progressFileName(s.deviceName));
}

watch(
  () => session.finishOpen,
  async (open) => {
    if (!open) return;
    message.value = null;
    summary.value = null;
    file.value = null;
    await prepare();
    await nextTick();
    dialog.value?.focus();
  },
);

async function save() {
  if (!file.value) return;
  busy.value = true;
  try {
    // A new device name goes into the file (and its file name), so make the file again first if it changed.
    const name = deviceName.value.trim();
    if (name !== (summary.value?.deviceName ?? "")) {
      await api.put("/device", { name });
      await prepare();
    }
    const result = await saveProgressFile(file.value);
    if (result === "cancelled") return;
    await api.post("/session/exported");
    summary.value = await api.get<Summary>("/session/summary");
    message.value = {
      ok: true,
      text: lang.t(result === "shared" ? "finish.shared" : "finish.downloaded"),
    };
  } catch (e) {
    message.value = { ok: false, text: (e as Error).message };
  } finally {
    busy.value = false;
  }
}

const sharing = computed(() => (file.value ? canShareFile(file.value) : false));
const accuracy = computed(() => (summary.value && summary.value.answersToday ? Math.round((summary.value.correctToday / summary.value.answersToday) * 100) : null));
</script>

<template>
  <div v-if="session.finishOpen" class="fixed inset-0 z-[60] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="finish-title" @keydown.esc="session.closeFinish()">
    <div ref="dialog" tabindex="-1" class="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 outline-none">
      <h2 id="finish-title" class="text-2xl font-extrabold"><UiLabel variant="heading" k="app.finish" /> 🌙</h2>
      <p v-if="!summary" class="mt-3 text-muted">{{ lang.t("common.loading") }}</p>

      <template v-else>
        <p v-if="summary.answersToday" class="mt-1 text-lg">
          <UiText k="finish.today" md :params="{ minutes: summary.minutesToday, answers: summary.answersToday }" /><template v-if="accuracy !== null"> {{ lang.t("finish.accuracy", { pct: accuracy }) }}</template><template v-if="summary.unitsCompletedToday">, {{ lang.t("finish.lessonsDone", { n: summary.unitsCompletedToday }, summary.unitsCompletedToday) }}</template>.
        </p>
        <p v-else class="mt-1 text-muted"><UiText k="finish.nothingYet" /></p>

        <div class="mt-4 rounded-2xl bg-surface-2 p-4">
          <p class="font-bold"><UiLabel variant="heading" k="finish.otherDevice" /></p>
          <p class="mt-1 text-sm text-muted"><UiText :k="sharing ? 'finish.otherDeviceShareHint' : 'finish.otherDeviceHint'" /></p>
          <label for="device" class="mt-3 block text-sm font-semibold">{{ lang.t("finish.deviceName") }}</label>
          <input id="device" v-model="deviceName" class="input mt-1" maxlength="40" :placeholder="lang.t('finish.devicePlaceholder')" autocomplete="off" />
          <p class="mt-2 text-sm text-muted">
            <template v-if="summary.lastExportAt">{{ lang.t("finish.lastSaved", { at: new Date(summary.lastExportAt).toLocaleString(lang.proseLocale, { dateStyle: "medium", timeStyle: "short" }) }) }}</template>
            <template v-else>{{ lang.t("dashboard.neverSaved") }}</template>
            <template v-if="summary.unsavedAnswers">{{ " " }}{{ lang.t("finish.unsaved", { n: summary.unsavedAnswers }, summary.unsavedAnswers) }}</template>
          </p>
        </div>

        <p v-if="message" role="status" class="mt-3 rounded-2xl p-3 font-semibold" :class="message.ok ? 'bg-good-bg text-good' : 'bg-bad-bg text-bad'">{{ message.ok ? "✓" : "✗" }} {{ message.text }}</p>

        <div class="mt-5 flex flex-wrap justify-end gap-3">
          <AppButton variant="secondary" @click="session.closeFinish()"><UiLabel k="common.close" /></AppButton>
          <AppButton :disabled="!file || busy" @click="save">{{ sharing ? "📤" : "⬇" }} <UiLabel :k="sharing ? 'finish.saveShare' : 'finish.save'" /></AppButton>
        </div>
      </template>
    </div>
  </div>
</template>
