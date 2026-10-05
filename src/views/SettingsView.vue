<script setup lang="ts">
import { onMounted, ref } from "vue";
import { useSettingsStore } from "../stores/settings";
import { api } from "../api/client";
import ImportSection from "../components/ImportSection.vue";
import KeyGuide from "../components/KeyGuide.vue";
import InstallHint from "../components/InstallHint.vue";
import { useSessionStore } from "../stores/session";
import { MODELS } from "@shared/claude/models";
import AppButton from "../components/ui/AppButton.vue";

const store = useSettingsStore();
const session = useSessionStore();
const newKey = ref("");
const saved = ref(false);
const resetText = ref("");
const resetMessage = ref<{ ok: boolean; text: string } | null>(null);

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

interface FlagRow {
  id: string;
  title: string;
  note: string;
  at: string;
}
const flags = ref<FlagRow[]>([]);
const loadFlags = async () => (flags.value = await api.get<FlagRow[]>("/flags"));
onMounted(loadFlags);
async function removeFlag(id: string) {
  await api.post(`/flags/${id}/remove`);
  await loadFlags();
}

const keyError = ref<string | null>(null);
const confirmRemove = ref(false);

async function saveKey() {
  if (!newKey.value.trim()) return;
  keyError.value = null;
  store.testResult = null;
  try {
    await store.saveKey(newKey.value);
    newKey.value = "";
    await store.testKey();
  } catch (e) {
    keyError.value = (e as Error).message;
  }
}

async function removeKey() {
  await store.removeKey();
  confirmRemove.value = false;
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
        <p class="mt-1 text-muted">Al je voortgang staat in de browser op dit apparaat. Bewaar je voortgang als bestand om een backup te maken of om op een ander apparaat verder te gaan.</p>
        <div class="mt-4 grid gap-5">
          <div>
            <AppButton variant="secondary" @click="session.openFinish()">🌙 Klaar voor vandaag: bewaar mijn voortgang</AppButton>
            <p class="mt-1 text-sm text-muted">Maakt een bestand om te delen met je andere apparaat of als backup. De API-sleutel zit niet in dit bestand.</p>
          </div>
          <ImportSection @imported="store.load()" />
        </div>

        <div class="mt-6 rounded-2xl border border-bad/40 bg-bad-bg p-4">
          <h3 class="font-bold text-bad">Voortgang wissen</h3>
          <p class="mt-1">Dit wist je voortgang en woordkaartjes. Je schrijfteksten blijven staan. Dit kun je niet ongedaan maken: bewaar eerst je voortgang als je die wilt houden.</p>
          <label for="reset" class="mt-3 block font-semibold">Typ <strong>RESET</strong> om te bevestigen</label>
          <input id="reset" v-model="resetText" class="input mt-1" autocomplete="off" />
          <AppButton class="mt-3" variant="bad" :disabled="resetText !== 'RESET'" @click="resetProgress">Wis mijn voortgang</AppButton>
          <p v-if="resetMessage" role="status" class="mt-3 font-semibold" :class="resetMessage.ok ? 'text-good' : 'text-bad'">{{ resetMessage.ok ? "✓" : "✗" }} {{ resetMessage.text }}</p>
        </div>
      </section>

      <InstallHint />

      <section v-if="flags.length" class="card p-6">
        <h2 class="text-xl font-bold">Mijn meldingen ({{ flags.length }})</h2>
        <p class="mt-1 text-sm text-muted">Fouten die je hebt gemeld. Ze zitten in je voortgangsbestand.</p>
        <ul class="mt-3 grid gap-2">
          <li v-for="f in flags" :key="f.id" class="flex items-start justify-between gap-3 rounded-2xl bg-surface-2 p-3">
            <div class="min-w-0">
              <p class="truncate font-semibold">{{ f.title }}</p>
              <p class="text-muted">{{ f.note || "(geen toelichting)" }}</p>
            </div>
            <button type="button" class="shrink-0 text-sm font-semibold underline hover:text-ink" @click="removeFlag(f.id)">Verwijder</button>
          </li>
        </ul>
      </section>

      <section class="card p-6">
        <h2 class="text-xl font-bold">Claude (optioneel)</h2>
        <p class="mt-1 text-muted">
          Met je eigen API-sleutel krijg je feedback op je teksten, uitleg bij fouten en extra oefeningen. De app werkt ook zonder sleutel.
          De sleutel wordt versleuteld op dit apparaat bewaard en gaat alleen naar Anthropic. Hij zit nooit in je gegevensbestand.
        </p>
        <p class="mt-3">Huidige sleutel: <strong>{{ store.settings.apiKey ?? "geen sleutel ingesteld" }}</strong></p>

        <label for="apiKey" class="mt-4 block font-semibold">{{ store.settings.apiKey ? "Nieuwe sleutel" : "Plak je sleutel" }}</label>
        <input id="apiKey" v-model="newKey" class="input mt-1" type="password" placeholder="sk-ant-..." autocomplete="off" spellcheck="false" @keydown.enter="saveKey" />
        <p v-if="keyError" role="alert" class="mt-2 font-semibold text-bad">✗ {{ keyError }}</p>
        <div class="mt-3 flex flex-wrap gap-3">
          <AppButton :disabled="!newKey.trim()" @click="saveKey">Opslaan en testen</AppButton>
          <AppButton v-if="store.settings.apiKey" variant="secondary" @click="store.testKey">Test sleutel</AppButton>
          <AppButton v-if="store.settings.apiKey && !confirmRemove" variant="ghost" @click="confirmRemove = true">Sleutel verwijderen</AppButton>
        </div>
        <div v-if="confirmRemove" class="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-bad-bg p-3">
          <span class="font-semibold">Sleutel van dit apparaat verwijderen?</span>
          <AppButton variant="bad" @click="removeKey">Ja, verwijderen</AppButton>
          <AppButton variant="secondary" @click="confirmRemove = false">Nee</AppButton>
        </div>
        <p v-if="store.testResult" role="status" class="mt-3 font-semibold" :class="store.testResult.ok ? 'text-good' : 'text-bad'">
          {{ store.testResult.ok ? "✓" : "✗" }} {{ store.testResult.message }}
        </p>

        <label for="model" class="mt-5 block font-semibold">Model</label>
        <select id="model" class="input mt-1" :value="store.settings.model" @change="patch({ model: ($event.target as HTMLSelectElement).value })">
          <option v-for="m in MODELS" :key="m.id" :value="m.id">{{ m.label }}</option>
        </select>

        <p v-if="store.settings.usage" class="mt-4 text-sm text-muted">
          Gebruik deze maand: ~{{ store.settings.usage.requests }} {{ store.settings.usage.requests === 1 ? "verzoek" : "verzoeken" }}
          ({{ store.settings.usage.inputTokens.toLocaleString("nl-NL") }} tokens erin, {{ store.settings.usage.outputTokens.toLocaleString("nl-NL") }} eruit)
        </p>
        <KeyGuide class="mt-4" />
      </section>
    </div>
    <p v-else class="text-muted">Even laden…</p>
  </div>
</template>
