<script setup lang="ts">
import { onMounted, ref } from "vue";
import { loadCourseContent } from "../content";
import AboutContent from "../components/AboutContent.vue";

const version = ref("");
onMounted(async () => (version.value = (await loadCourseContent()).version));
</script>

<template>
  <div class="mx-auto grid max-w-3xl gap-6">
    <h1 class="text-3xl font-extrabold tracking-tight">Over deze app</h1>
    <AboutContent />
    <p v-if="version" class="text-center text-sm text-muted">Versie van de cursus: {{ version }}</p>
  </div>
</template>
