<script setup lang="ts">
import { useRouter } from "vue-router";
import { api } from "../api/client";
import AboutContent from "../components/AboutContent.vue";
import ImportSection from "../components/ImportSection.vue";
import LanguagePicker from "../components/LanguagePicker.vue";
import AppButton from "../components/ui/AppButton.vue";
import UiLabel from "../components/ui/UiLabel.vue";
import UiText from "../components/ui/UiText.vue";
import { useLanguageStore } from "../stores/language";

const router = useRouter();
const lang = useLanguageStore();
async function start() {
  // Starting without touching the picker keeps the language it showed (the browser's, or the landing page's).
  if (!lang.chosen) await lang.choose(lang.locale);
  await api.post("/welcome/seen");
  router.replace("/");
}
</script>

<template>
  <div class="mx-auto grid max-w-3xl gap-6">
    <header class="text-center">
      <div class="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand text-3xl font-extrabold text-white" aria-hidden="true">NL</div>
      <h1 class="mt-4 text-4xl font-extrabold tracking-tight"><UiLabel k="welcome.title" /></h1>
      <p class="mt-2 text-lg text-muted"><UiText k="welcome.intro" /></p>
    </header>

    <section class="card p-6"><LanguagePicker /></section>

    <div class="text-center">
      <AppButton size="lg" @click="start">▶ <UiLabel k="welcome.start" /></AppButton>
    </div>

    <AboutContent />

    <section class="card p-6">
      <h2 class="text-xl font-bold"><UiLabel k="welcome.otherDevice" /></h2>
      <p class="mt-1 text-muted"><UiText k="welcome.otherDeviceHint" /></p>
      <div class="mt-3"><ImportSection @imported="start" /></div>
    </section>

    <div class="text-center">
      <AppButton size="lg" @click="start">▶ <UiLabel k="welcome.start" /></AppButton>
    </div>
  </div>
</template>
