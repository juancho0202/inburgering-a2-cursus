<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { api } from "../api/client";
import type { ProgressFile } from "@shared/schemas/transfer";
import { useSessionStore } from "../stores/session";
import { canShareFile, makeProgressFile, progressFileName, saveProgressFile } from "../lib/progressFile";
import AppButton from "./ui/AppButton.vue";

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
      text: result === "shared" ? "Bewaard! Open het bestand op je andere apparaat bij “Ga verder met een bestand”." : "Bewaard in je downloads. Zet het bestand op je andere apparaat (bijvoorbeeld met AirDrop) en kies daar “Ga verder met een bestand”.",
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
      <h2 id="finish-title" class="text-2xl font-extrabold">Klaar voor vandaag 🌙</h2>
      <p v-if="!summary" class="mt-3 text-muted">Even laden…</p>

      <template v-else>
        <p v-if="summary.answersToday" class="mt-1 text-lg">
          Goed gedaan! Vandaag: <strong>{{ summary.minutesToday }} minuten</strong>, <strong>{{ summary.answersToday }} antwoorden</strong><template v-if="accuracy !== null"> ({{ accuracy }}% goed)</template><template v-if="summary.unitsCompletedToday">, {{ summary.unitsCompletedToday }} {{ summary.unitsCompletedToday === 1 ? "les" : "lessen" }} klaar</template>.
        </p>
        <p v-else class="mt-1 text-muted">Je hebt vandaag nog niets gedaan, maar je kunt je voortgang wel bewaren.</p>

        <div class="mt-4 rounded-2xl bg-surface-2 p-4">
          <p class="font-bold">Verder op een ander apparaat?</p>
          <p class="mt-1 text-sm text-muted">
            Bewaar je voortgang als bestand en zet dat op je andere apparaat{{ sharing ? " (kies bijvoorbeeld AirDrop)" : "" }}. Daar kies je “Ga verder met een bestand”. Je antwoorden worden samengevoegd; er gaat niets kwijt.
          </p>
          <label for="device" class="mt-3 block text-sm font-semibold">Naam van dit apparaat</label>
          <input id="device" v-model="deviceName" class="input mt-1" maxlength="40" placeholder="Bijvoorbeeld: Laptop" autocomplete="off" />
          <p class="mt-2 text-sm text-muted">
            <template v-if="summary.lastExportAt">Laatst bewaard: {{ new Date(summary.lastExportAt).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" }) }}.</template>
            <template v-else>Je hebt je voortgang nog niet bewaard.</template>
            <template v-if="summary.unsavedAnswers">{{ " " }}{{ summary.unsavedAnswers }} nieuwe antwoorden zijn nog niet bewaard.</template>
          </p>
        </div>

        <p v-if="message" role="status" class="mt-3 rounded-2xl p-3 font-semibold" :class="message.ok ? 'bg-good-bg text-good' : 'bg-bad-bg text-bad'">{{ message.ok ? "✓" : "✗" }} {{ message.text }}</p>

        <div class="mt-5 flex flex-wrap justify-end gap-3">
          <AppButton variant="secondary" @click="session.closeFinish()">Sluiten</AppButton>
          <AppButton :disabled="!file || busy" @click="save">{{ sharing ? "📤 Bewaar en deel" : "⬇ Bewaar voortgang" }}</AppButton>
        </div>
      </template>
    </div>
  </div>
</template>
