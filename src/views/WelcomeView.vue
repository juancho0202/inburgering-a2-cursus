<script setup lang="ts">
import { useRouter } from "vue-router";
import { api } from "../api/client";
import AboutContent from "../components/AboutContent.vue";
import ImportSection from "../components/ImportSection.vue";
import AppButton from "../components/ui/AppButton.vue";

const router = useRouter();
async function start() {
  await api.post("/welcome/seen");
  router.replace("/");
}
</script>

<template>
  <div class="mx-auto grid max-w-3xl gap-6">
    <header class="text-center">
      <div class="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand text-3xl font-extrabold text-white" aria-hidden="true">NL</div>
      <h1 class="mt-4 text-4xl font-extrabold tracking-tight">Welkom bij Inburgering A2</h1>
      <p class="mt-2 text-lg text-muted">Oefen Lezen, KNM en Schrijven, in je eigen tempo.</p>
      <AppButton size="lg" class="mt-5" @click="start">▶ Begin met leren</AppButton>
    </header>

    <AboutContent />

    <section class="card p-6">
      <h2 class="text-xl font-bold">Heb je al voortgang op een ander apparaat?</h2>
      <p class="mt-1 text-muted">Kies het bestand dat je daar hebt bewaard. Ook een bestand van de oude versie van de app werkt.</p>
      <div class="mt-3"><ImportSection @imported="start" /></div>
    </section>

    <div class="text-center">
      <AppButton size="lg" @click="start">▶ Begin met leren</AppButton>
    </div>
  </div>
</template>
