<script setup lang="ts">
import { onMounted } from "vue";
import { useContentStore } from "../stores/content";

const content = useContentStore();
onMounted(() => content.load());
</script>

<template>
  <h1>Inburgering A2</h1>
  <p>Welkom terug! Kies een module om te oefenen.</p>

  <div v-if="content.loading">Even laden…</div>
  <ul v-else-if="content.course">
    <li v-for="mod in content.course.modules" :key="mod.id">
      <RouterLink :to="`/module/${mod.id}`">{{ mod.title }}</RouterLink>
      <p>{{ mod.description }}</p>
    </li>
  </ul>
</template>
