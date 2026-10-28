<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from "vue";
import { isInstalled, isIos, requestPersistentStorage, storageStatus, type StorageStatus } from "../lib/storage";
import AppButton from "./ui/AppButton.vue";
import UiLabel from "./ui/UiLabel.vue";
import UiText from "./ui/UiText.vue";
import { useLanguageStore } from "../stores/language";

// Chrome and Edge offer a real install button; iPhones need the Share menu instead.
let deferred: { prompt: () => Promise<void> } | null = null;
const canPrompt = ref(false);
const installed = ref(isInstalled());
const ios = isIos();
const status = ref<StorageStatus | null>(null);
const lang = useLanguageStore();

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
    <h2 class="text-xl font-bold"><UiLabel variant="heading" k="install.title" /></h2>
    <template v-if="installed">
      <p class="mt-2 font-semibold text-good">✓ {{ lang.t("install.installed") }}</p>
    </template>
    <template v-else>
      <p class="mt-2 text-muted"><UiText k="install.hint" /></p>
      <AppButton v-if="canPrompt" class="mt-3" @click="install">⬇ <UiLabel k="install.button" /></AppButton>
      <p v-else-if="ios" class="mt-3 rounded-2xl bg-surface-2 p-3"><UiText k="install.ios" md /></p>
      <p v-else class="mt-3 text-sm text-muted"><UiText k="install.other" /></p>
    </template>

    <div v-if="status" class="mt-4 text-sm">
      <p>
        {{ lang.t("install.protected") }}
        <strong :class="status.persisted ? 'text-good' : 'text-brand-strong'">{{ lang.t(status.persisted ? "install.yes" : status.persisted === false ? "install.notYet" : "install.unknown") }}</strong>
        <template v-if="status.usedMb !== null"> · {{ lang.t("install.used", { mb: status.usedMb }) }}</template>
      </p>
      <AppButton v-if="status.persisted === false" class="mt-2" variant="secondary" @click="protect"><UiLabel k="install.protect" /></AppButton>
    </div>
  </section>
</template>
