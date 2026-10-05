<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { isInstalled, isIos, requestPersistentStorage, storageStatus, type StorageStatus } from "../lib/storage";
import AppButton from "./ui/AppButton.vue";

// Chrome and Edge offer a real install button; iPhones need the Share menu instead.
let deferred: { prompt: () => Promise<void> } | null = null;
const canPrompt = ref(false);
const installed = ref(isInstalled());
const ios = isIos();
const status = ref<StorageStatus | null>(null);

const onBeforeInstall = (e: Event) => {
  e.preventDefault();
  deferred = e as unknown as { prompt: () => Promise<void> };
  canPrompt.value = true;
};
const onInstalled = () => (installed.value = true);

onMounted(async () => {
  window.addEventListener("beforeinstallprompt", onBeforeInstall);
  window.addEventListener("appinstalled", onInstalled);
  status.value = await storageStatus();
});
onBeforeUnmount(() => {
  window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  window.removeEventListener("appinstalled", onInstalled);
});

async function install() {
  await deferred?.prompt();
  canPrompt.value = false;
}
async function protect() {
  await requestPersistentStorage();
  status.value = await storageStatus();
}
</script>

<template>
  <section class="card p-6">
    <h2 class="text-xl font-bold">Op je telefoon of beginscherm</h2>
    <template v-if="installed">
      <p class="mt-2 font-semibold text-good">✓ De app is geïnstalleerd op dit apparaat.</p>
    </template>
    <template v-else>
      <p class="mt-2 text-muted">Zet de app op je beginscherm. Dan opent hij als een gewone app, werkt hij ook zonder internet (behalve de Claude-hulp) en wordt je voortgang beter beschermd.</p>
      <AppButton v-if="canPrompt" class="mt-3" @click="install">⬇ Installeer de app</AppButton>
      <p v-else-if="ios" class="mt-3 rounded-2xl bg-surface-2 p-3">
        <strong>iPhone of iPad:</strong> tik in Safari op <strong>Deel</strong> (het vierkantje met een pijl) en kies <strong>Zet op beginscherm</strong>. Doe dit zeker: Safari kan de gegevens van een website wissen die niet op het beginscherm staat.
      </p>
      <p v-else class="mt-3 text-sm text-muted">Gebruik het menu van je browser en kies “App installeren” of “Zet op beginscherm”.</p>
    </template>

    <div v-if="status" class="mt-4 text-sm">
      <p>
        Opslag beschermd tegen automatisch wissen:
        <strong :class="status.persisted ? 'text-good' : 'text-brand-strong'">{{ status.persisted ? "ja" : status.persisted === false ? "nog niet" : "onbekend" }}</strong>
        <template v-if="status.usedMb !== null"> · in gebruik: {{ status.usedMb }} MB</template>
      </p>
      <AppButton v-if="status.persisted === false" class="mt-2" variant="secondary" @click="protect">Vraag bescherming aan</AppButton>
    </div>
  </section>
</template>
