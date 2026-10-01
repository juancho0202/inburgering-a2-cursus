<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import { api } from "../api/client";

interface Unit {
  id: string;
  title: string;
  goal: string;
  steps: unknown[];
}

const route = useRoute();
const unit = ref<Unit | null>(null);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    unit.value = await api.get<Unit>(`/units/${route.params.id}`);
  } catch (err) {
    error.value = (err as Error).message;
  }
});
</script>

<template>
  <p v-if="error">{{ error }}</p>
  <div v-else-if="unit">
    <h1>{{ unit.title }}</h1>
    <p>{{ unit.goal }}</p>
    <p>Deze les heeft {{ unit.steps.length }} stap(pen). De lesspeler komt in Fase 2.</p>
  </div>
  <p v-else>Even laden…</p>
</template>
