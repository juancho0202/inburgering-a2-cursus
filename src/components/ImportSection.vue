<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../api/client";
import { readJsonFile } from "../lib/progressFile";
import AppButton from "./ui/AppButton.vue";
import UiLabel from "./ui/UiLabel.vue";
import UiText from "./ui/UiText.vue";
import { useLanguageStore } from "../stores/language";

interface Count {
  new: number;
  updated: number;
  total: number;
}
interface Preview {
  from: { deviceName: string | null; exportedAt: string; legacy: boolean };
  contentChanged: boolean;
  unknownItems: number;
  counts: Record<string, Count>;
  settingsReplaced: boolean;
  lastLocationReplaced: boolean;
  nothingNew: boolean;
}

const emit = defineEmits<{ imported: [] }>();
const lang = useLanguageStore();
const input = ref<HTMLInputElement | null>(null);
const parsed = ref<unknown>(null);
const preview = ref<Preview | null>(null);
const fileName = ref("");
const error = ref<string | null>(null);
const done = ref<string | null>(null);
const busy = ref(false);
const last = ref<{ at: string; from: string | null } | null>(null);

// One plural message per kind of data in the file ("one | many").
const label = (key: string, n: number) => lang.t(`import.kind.${key}`, {}, n);

async function refreshLast() {
  last.value = await api.get("/import/last");
}
onMounted(refreshLast);

async function pick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  error.value = null;
  done.value = null;
  preview.value = null;
  fileName.value = f.name;
  try {
    parsed.value = await readJsonFile(f);
  } catch {
    error.value = lang.t("import.unreadable");
    return;
  }
  try {
    preview.value = await api.post<Preview>("/import/preview", { file: parsed.value });
  } catch (err) {
    error.value = (err as Error).message;
  }
}

async function apply() {
  busy.value = true;
  try {
    await api.post("/import/apply", { file: parsed.value });
    done.value = lang.t("import.merged");
    preview.value = null;
    parsed.value = null;
    await refreshLast();
    emit("imported");
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    busy.value = false;
    if (input.value) input.value.value = "";
  }
}

async function undo() {
  try {
    await api.post("/import/undo");
    done.value = lang.t("import.undone");
    await refreshLast();
    emit("imported");
  } catch (err) {
    error.value = (err as Error).message;
  }
}

const fmt = (iso: string) => new Date(iso).toLocaleString(lang.proseLocale, { dateStyle: "medium", timeStyle: "short" });
const changes = (p: Preview) => Object.entries(p.counts).filter(([, c]) => c.new || c.updated);
</script>

<template>
  <div>
    <input ref="input" type="file" accept="application/json,.json" class="sr-only" :aria-label="lang.t('import.choose')" @change="pick" />
    <AppButton variant="secondary" @click="input?.click()">📂 <UiLabel k="import.button" /></AppButton>
    <p class="mt-1 text-sm text-muted"><UiText k="import.hint" /></p>

    <p v-if="error" role="alert" class="mt-3 rounded-2xl bg-bad-bg p-3 font-semibold text-bad">✗ {{ error }}</p>
    <p v-if="done" role="status" class="mt-3 rounded-2xl bg-good-bg p-3 font-semibold text-good">✓ {{ done }}</p>

    <div v-if="preview" class="slide-up mt-4 rounded-2xl border border-line p-4">
      <p class="font-bold">
        {{ fileName }}
        <span class="font-normal text-muted">· {{ lang.t("import.from", { from: preview.from.legacy ? lang.t("import.oldVersion") : (preview.from.deviceName ?? lang.t("import.otherDevice")), at: fmt(preview.from.exportedAt) }) }}</span>
      </p>
      <p v-if="preview.nothingNew" class="mt-2 font-semibold text-good">✓ {{ lang.t("import.nothingNew") }}</p>
      <template v-else>
        <p class="mt-2">{{ lang.t("import.added") }}</p>
        <ul class="mt-1 grid gap-0.5">
          <li v-for="[key, c] in changes(preview)" :key="key">
            <strong>{{ c.new + c.updated }}</strong> {{ label(key, c.new + c.updated) }}
            <span v-if="c.updated" class="text-muted">{{ lang.t("import.newUpdated", { new: c.new, updated: c.updated }) }}</span>
          </li>
          <li v-if="preview.settingsReplaced">{{ lang.t("import.settings") }}</li>
          <li v-if="preview.lastLocationReplaced">{{ lang.t("import.lastLocation") }}</li>
        </ul>
        <p class="mt-2 text-sm text-muted">{{ lang.t("import.nothingRemoved") }}</p>
      </template>
      <p v-if="preview.contentChanged" class="mt-2 rounded-xl bg-brand-bg p-2 text-sm font-semibold text-brand-strong">
        {{ lang.t("import.otherCourse") }}<template v-if="preview.unknownItems"> {{ lang.t("import.unknownItems", { n: preview.unknownItems }) }}</template>
      </p>
      <div class="mt-3 flex flex-wrap gap-3">
        <AppButton :disabled="busy || preview.nothingNew" @click="apply"><UiLabel k="import.merge" /></AppButton>
        <AppButton variant="ghost" @click="preview = null"><UiLabel k="common.cancel" /></AppButton>
      </div>
    </div>

    <p v-if="last" class="mt-3 text-sm text-muted">
      {{ lang.t("import.last", { at: fmt(last.at) }) }}<template v-if="last.from"> {{ lang.t("import.lastFrom", { from: last.from }) }}</template>.
      <button type="button" class="font-semibold underline hover:text-ink" @click="undo"><UiLabel k="import.undo" /></button>
    </p>
  </div>
</template>
