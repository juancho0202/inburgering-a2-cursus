<script setup lang="ts">
import { RouterLink } from "vue-router";
import KeyGuide from "./KeyGuide.vue";
import UiLabel from "./ui/UiLabel.vue";
import UiText from "./ui/UiText.vue";
</script>

<template>
  <!-- minmax(0, 1fr): a card can shrink to the screen instead of growing to its longest word -->
  <div class="grid grid-cols-[minmax(0,1fr)] gap-5">
    <section class="card p-6">
      <h2 class="text-xl font-bold"><UiLabel variant="heading" k="about.whatTitle" /></h2>
      <p class="mt-2"><UiText k="about.what" md /></p>
      <p class="mt-3 rounded-2xl bg-brand-bg px-4 py-3 font-semibold text-brand-strong"><UiText k="about.notDuo" md /></p>
    </section>

    <section class="card p-6">
      <h2 class="text-xl font-bold"><UiLabel variant="heading" k="about.dataTitle" /></h2>
      <ul class="mt-2 grid list-disc gap-1 pl-5">
        <li><UiText k="about.data1" md /></li>
        <li><UiText k="about.data2" md /></li>
        <li><UiText k="about.data3" /></li>
      </ul>
    </section>

    <section class="card p-6">
      <h2 class="text-xl font-bold"><UiLabel variant="heading" k="about.devicesTitle" /></h2>
      <p class="mt-2"><UiText k="about.devices" md /></p>
    </section>

    <section class="card p-6">
      <h2 class="text-xl font-bold"><UiLabel variant="heading" k="settings.claude" /></h2>
      <p class="mt-2"><UiText k="about.claude" md /></p>
      <KeyGuide class="mt-3" />
      <RouterLink to="/instellingen" class="mt-3 inline-block font-semibold text-brand-strong underline"><UiLabel k="common.toSettings" /></RouterLink>
    </section>

    <section class="card p-6">
      <h2 class="text-xl font-bold"><UiLabel variant="heading" k="about.voicesTitle" /></h2>
      <p class="mt-2">
        <UiText k="about.voices1" /> <a href="https://github.com/OHF-Voice/piper1-gpl" target="_blank" rel="noopener noreferrer" class="font-semibold underline">Piper</a> <UiText k="about.voices2" />
      </p>
    </section>

    <section class="card p-6">
      <h2 class="text-xl font-bold"><UiLabel variant="heading" k="about.creditTitle" /></h2>
      <!-- A name and a username: browser translators must leave them alone -->
      <p class="mt-2">
        <UiText k="about.credit" /> <strong translate="no">Juan David Muñoz</strong> ·
        <a href="https://github.com/juancho0202" target="_blank" rel="noopener noreferrer" class="font-semibold underline" translate="no">github.com/juancho0202</a>
      </p>
    </section>
  </div>
</template>
