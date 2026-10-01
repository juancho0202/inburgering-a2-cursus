<script setup lang="ts">
import { computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useContentStore } from "../stores/content";

const route = useRoute();
const content = useContentStore();
onMounted(() => {
  if (!content.course) content.load();
});

const mod = computed(() => content.course?.modules.find((m) => m.id === route.params.id));
</script>

<template>
  <div v-if="mod">
    <h1>{{ mod.title }}</h1>
    <p>{{ mod.description }}</p>
    <ul>
      <li v-for="unit in mod.units" :key="unit.id">
        <RouterLink :to="`/unit/${unit.id}`">{{ unit.title }}</RouterLink>
        — {{ unit.estimatedMinutes }} min
      </li>
    </ul>
  </div>
  <p v-else>Even laden…</p>
</template>
