<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useSettingsStore } from "../stores/settings";
import { api } from "../api/client";
import AppButton from "../components/ui/AppButton.vue";

const store = useSettingsStore();
const newKey = ref("");
const saved = ref(false);
const resetText = ref("");
const resetMessage = ref<{ ok: boolean; text: string } | null>(null);

/** Saves everything as one file. (Step 5 turns this into the share/AirDrop flow.) */
async function downloadData() {
  const bundle = await api.get<unknown>("/export");
  const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `inburgering-a2-voortgang-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function resetProgress() {
  try {
    await api.post("/progress/reset", { confirm: resetText.value });
    resetText.value = "";
    resetMessage.value = { ok: true, text: "Je voortgang is gewist. Je gegevens zijn gewist." };
  } catch (e) {
    resetMessage.value = { ok: false, text: (e as Error).message };
  }
}

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
        <h2 class="text-xl font-bold">Mijn gegevens</h2>
        <p class="mt-1 text-muted">Al je voortgang staat in de browser op dit apparaat. Download je gegevens om een backup te maken of om op een ander apparaat verder te gaan.</p>
        <AppButton class="mt-3" variant="secondary" @click="downloadData">⬇ Download mijn gegevens</AppButton>
        <p class="mt-1 text-sm text-muted">De API-sleutel zit niet in dit bestand.</p>

        <div class="mt-6 rounded-2xl border border-bad/40 bg-bad-bg p-4">
          <h3 class="font-bold text-bad">Voortgang wissen</h3>
          <p class="mt-1">Dit wist je voortgang en woordkaartjes. Je schrijfteksten blijven staan. Dit kun je niet ongedaan maken: download eerst je gegevens als je ze wilt bewaren.</p>
          <label for="reset" class="mt-3 block font-semibold">Typ <strong>RESET</strong> om te bevestigen</label>
          <input id="reset" v-model="resetText" class="input mt-1" autocomplete="off" />
          <AppButton class="mt-3" variant="bad" :disabled="resetText !== 'RESET'" @click="resetProgress">Wis mijn voortgang</AppButton>
          <p v-if="resetMessage" role="status" class="mt-3 font-semibold" :class="resetMessage.ok ? 'text-good' : 'text-bad'">{{ resetMessage.ok ? "✓" : "✗" }} {{ resetMessage.text }}</p>
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
