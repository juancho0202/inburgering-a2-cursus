<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { api } from "../api/client";
import { newIssueUrl } from "../lib/github";
import AppButton from "./ui/AppButton.vue";
import UiLabel from "./ui/UiLabel.vue";
import UiText from "./ui/UiText.vue";
import { useLanguageStore } from "../stores/language";

const props = defineProps<{ itemId: string; label?: string }>();

interface Target {
  itemId: string;
  source: { file: string; title: string } | null;
}

const lang = useLanguageStore();
const open = ref(false);
const note = ref("");
/** "github": the issue page was opened; "saved": the note is kept on this device. */
const sent = ref<"github" | "saved" | null>(null);
const error = ref<string | null>(null);
const target = ref<Target | null>(null);
const field = ref<HTMLTextAreaElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);

// Items outside data/course (exercises made by Claude) have no file to report on, so they can only be saved here.
const issueUrl = computed(() => {
  const source = target.value?.source;
  return source ? newIssueUrl({ itemId: props.itemId, ...source, note: note.value }) : null;
});

async function show() {
  open.value = true;
  sent.value = null;
  error.value = null;
  note.value = "";
  await nextTick();
  field.value?.focus();
  try {
    target.value = await api.get<Target>(`/flags/target/${encodeURIComponent(props.itemId)}`);
  } catch {
    target.value = null;
  }
}
function close() {
  open.value = false;
  nextTick(() => trigger.value?.focus());
}
async function save() {
  error.value = null;
  try {
    await api.post("/flags", { itemId: props.itemId, note: note.value });
    sent.value = "saved";
  } catch (e) {
    error.value = (e as Error).message;
  }
}
</script>

<template>
  <button
    ref="trigger"
    type="button"
    class="inline-flex items-center gap-1.5 rounded-xl border border-flag/40 px-3 py-1.5 text-sm font-semibold text-muted transition hover:border-flag hover:bg-flag-bg hover:text-flag"
    @click="show"
  >
    <span aria-hidden="true" class="text-flag">⚑</span> <template v-if="label">{{ label }}</template><UiLabel v-else k="report.button" />
  </button>

  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="report-title" @keydown.esc="close">
      <div class="card w-full max-w-md p-6">
        <h2 id="report-title" class="text-xl font-extrabold"><UiLabel k="report.button" /></h2>
        <template v-if="!sent">
          <p v-if="issueUrl" class="mt-1 text-muted"><UiText k="report.githubHint" /></p>
          <p v-else class="mt-1 text-muted"><UiText k="report.localHint" /></p>
          <label for="report-note" class="mt-4 block font-semibold">{{ lang.t("report.what") }}</label>
          <textarea id="report-note" ref="field" v-model="note" rows="4" maxlength="500" class="input mt-1" :placeholder="lang.t('report.placeholder')" />
          <p v-if="error" role="alert" class="mt-2 font-semibold text-bad">✗ {{ error }}</p>
          <div class="mt-4 flex flex-wrap justify-end gap-3">
            <AppButton variant="secondary" @click="close"><UiLabel k="common.cancel" /></AppButton>
            <a v-if="issueUrl" :href="issueUrl" target="_blank" rel="noopener noreferrer" @click="sent = 'github'">
              <AppButton tabindex="-1"><UiLabel k="report.github" /> ↗</AppButton>
            </a>
            <AppButton v-else @click="save"><UiLabel k="report.save" /></AppButton>
          </div>
          <p v-if="issueUrl" class="mt-3 text-sm text-muted">
            {{ lang.t("report.noAccount") }}
            <button type="button" class="font-semibold underline hover:text-ink" @click="save">{{ lang.t("report.saveHere") }}</button>
            {{ lang.t("report.sendLater") }}
          </p>
        </template>
        <template v-else-if="sent === 'github'">
          <p role="status" class="mt-3 rounded-2xl bg-good-bg p-3 font-semibold text-good">✓ {{ lang.t("report.opened") }}</p>
          <p class="mt-2 text-sm text-muted"><UiText k="report.openedHint" md /></p>
          <div class="mt-4 flex justify-end"><AppButton @click="close"><UiLabel k="common.close" /></AppButton></div>
        </template>
        <template v-else>
          <p role="status" class="mt-3 rounded-2xl bg-good-bg p-3 font-semibold text-good">✓ {{ lang.t("report.saved") }}</p>
          <p class="mt-2 text-sm text-muted"><UiText k="report.savedHint" /></p>
          <div class="mt-4 flex justify-end"><AppButton @click="close"><UiLabel k="common.close" /></AppButton></div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
