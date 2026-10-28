<script setup lang="ts">
import { onMounted, ref } from "vue";
import { loadCourseContent } from "../content";
import AboutContent from "../components/AboutContent.vue";
import UiLabel from "../components/ui/UiLabel.vue";
import { useLanguageStore } from "../stores/language";

const lang = useLanguageStore();
const version = ref("");
onMounted(async () => (version.value = (await loadCourseContent()).version));
</script>

<template>
  <div class="mx-auto grid max-w-3xl gap-6">
    <h1 class="text-3xl font-extrabold tracking-tight"><UiLabel k="app.about" /></h1>
    <AboutContent />
    <p v-if="version" class="text-center text-sm text-muted">{{ lang.t("about.version", { version }) }}</p>
  </div>
</template>
