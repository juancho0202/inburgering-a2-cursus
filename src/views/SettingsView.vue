<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useSettingsStore } from "../stores/settings";
import AppButton from "../components/ui/AppButton.vue";

const store = useSettingsStore();
const newKey = ref("");
const saved = ref(false);

onMounted(() => store.load());

async function saveKey() {
  if (!newKey.value) return;
  await store.update({ apiKey: newKey.value });
  newKey.value = "";
  await store.testKey();
}
const num = (e: Event) => Number((e.target as HTMLInputElement).value);
async function patch(p: Parameters<typeof store.update>[0]) {
  await store.update(p);
  saved.value = true;
  setTimeout(() => (saved.value = false), 1500);
}
const themes = [
  { value: "system", label: "Automatisch" },
  { value: "light", label: "Licht" },
  { value: "dark", label: "Donker" },
] as const;
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-3xl font-extrabold tracking-tight">Instellingen</h1>
      <span v-if="saved" role="status" class="rounded-full bg-good-bg px-3 py-1 text-sm font-bold text-good">✓ Opgeslagen</span>
    </div>

    <div v-if="store.settings" class="grid gap-6">
      <section class="card p-6">
        <h2 class="text-xl font-bold">Uiterlijk</h2>
        <div class="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Thema">
          <button
            v-for="t in themes"
            :key="t.value"
            type="button"
            role="radio"
            :aria-checked="store.settings.theme === t.value"
            class="rounded-2xl border-2 px-3 py-2.5 font-semibold transition"
            :class="store.settings.theme === t.value ? 'border-brand bg-brand-bg text-brand-strong' : 'border-line hover:border-brand'"
            @click="patch({ theme: t.value })"
          >
            {{ t.label }}
          </button>
        </div>
      </section>

      <section class="card p-6">
        <h2 class="text-xl font-bold">Leren</h2>
        <div class="mt-3 grid gap-4 sm:grid-cols-2">
          <label class="block"><span class="font-semibold">Minuten per dag</span>
            <input class="input mt-1" type="number" min="5" max="240" :value="store.settings.dailyGoalMinutes" @change="patch({ dailyGoalMinutes: num($event) })" /></label>
          <label class="block"><span class="font-semibold">Nieuwe woorden per dag</span>
            <input class="input mt-1" type="number" min="1" max="100" :value="store.settings.newCardsPerDay" @change="patch({ newCardsPerDay: num($event) })" /></label>
          <label class="block"><span class="font-semibold">Spreeksnelheid ({{ store.settings.speechRate }})</span>
            <input class="mt-3 w-full accent-[var(--brand)]" type="range" min="0.6" max="1.2" step="0.05" :value="store.settings.speechRate" @change="patch({ speechRate: num($event) })" /></label>
          <label class="flex items-center gap-3 self-end pb-2 font-semibold">
            <input type="checkbox" class="h-5 w-5 accent-[var(--brand)]" :checked="store.settings.spellcheckWriting" @change="patch({ spellcheckWriting: ($event.target as HTMLInputElement).checked })" />
            Spellingcontrole bij schrijven
          </label>
        </div>
      </section>

      <section class="card p-6">
        <h2 class="text-xl font-bold">Claude API-sleutel</h2>
        <p class="mt-1 text-muted">Huidige sleutel: <strong class="text-ink">{{ store.settings.apiKey ?? "geen sleutel ingesteld" }}</strong></p>
        <label for="apiKey" class="mt-4 block font-semibold">Nieuwe sleutel</label>
        <input id="apiKey" v-model="newKey" class="input mt-1" type="password" placeholder="sk-ant-..." autocomplete="off" />
        <div class="mt-3 flex flex-wrap gap-3">
          <AppButton :disabled="!newKey" @click="saveKey">Opslaan en testen</AppButton>
          <AppButton variant="secondary" @click="store.testKey">Test sleutel</AppButton>
        </div>
        <p v-if="store.settings.usage" class="mt-4 text-sm text-muted">
          Gebruik deze maand: ~{{ store.settings.usage.requests }} {{ store.settings.usage.requests === 1 ? "verzoek" : "verzoeken" }}
          ({{ store.settings.usage.inputTokens.toLocaleString("nl-NL") }} tokens erin, {{ store.settings.usage.outputTokens.toLocaleString("nl-NL") }} eruit)
        </p>
        <p v-if="store.testResult" role="status" class="mt-3 font-semibold" :class="store.testResult.ok ? 'text-good' : 'text-bad'">
          {{ store.testResult.ok ? "✓" : "✗" }} {{ store.testResult.message }}
        </p>
      </section>
    </div>
    <p v-else class="text-muted">Even laden…</p>
  </div>
</template>
