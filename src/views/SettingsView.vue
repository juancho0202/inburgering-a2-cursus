<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useSettingsStore } from "../stores/settings";

const store = useSettingsStore();
const newKey = ref("");

onMounted(() => store.load());

async function saveKey() {
  if (!newKey.value) return;
  await store.update({ apiKey: newKey.value });
  newKey.value = "";
}
</script>

<template>
  <h1>Instellingen</h1>

  <div v-if="store.settings">
    <section>
      <h2>Claude API-sleutel</h2>
      <p>Huidige sleutel: <strong>{{ store.settings.apiKey ?? "geen sleutel ingesteld" }}</strong></p>
      <label for="apiKey">Nieuwe sleutel</label>
      <input id="apiKey" v-model="newKey" type="password" placeholder="sk-ant-..." />
      <button type="button" @click="saveKey">Opslaan</button>
      <button type="button" @click="store.testKey">Test sleutel</button>
      <p v-if="store.testResult">{{ store.testResult.message }}</p>
    </section>

    <section>
      <h2>Dagelijks doel</h2>
      <label for="goal">Minuten per dag</label>
      <input
        id="goal"
        type="number"
        :value="store.settings.dailyGoalMinutes"
        @change="store.update({ dailyGoalMinutes: Number(($event.target as HTMLInputElement).value) })"
      />
    </section>
  </div>
  <p v-else>Even laden…</p>
</template>
