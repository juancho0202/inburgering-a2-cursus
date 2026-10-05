<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api } from "../api/client";
import { readJsonFile } from "../lib/progressFile";
import AppButton from "./ui/AppButton.vue";

interface Count {
  new: number;
  updated: number;
  total: number;
}
interface Preview {
  from: { deviceName: string | null; exportedAt: string; legacy: boolean };
  contentChanged: boolean;
  unknownItems: number;
  counts: Record<string, Count>;
  settingsReplaced: boolean;
  lastLocationReplaced: boolean;
  nothingNew: boolean;
}

const emit = defineEmits<{ imported: [] }>();
const input = ref<HTMLInputElement | null>(null);
const parsed = ref<unknown>(null);
const preview = ref<Preview | null>(null);
const fileName = ref("");
const error = ref<string | null>(null);
const done = ref<string | null>(null);
const busy = ref(false);
const last = ref<{ at: string; from: string | null } | null>(null);

// [one, many]
const labels: Record<string, [string, string]> = {
  attempts: ["antwoord", "antwoorden"],
  units: ["les", "lessen"],
  srsCards: ["woordkaartje", "woordkaartjes"],
  writing: ["tekst", "teksten"],
  examResults: ["examen", "examens"],
  explanations: ["uitleg van Claude", "uitleg van Claude"],
  generated: ["extra oefening", "extra oefeningen"],
  flags: ["gemelde fout", "gemelde fouten"],
};
const label = (key: string, n: number) => labels[key][n === 1 ? 0 : 1];

async function refreshLast() {
  last.value = await api.get("/import/last");
}
onMounted(refreshLast);

async function pick(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0];
  if (!f) return;
  error.value = null;
  done.value = null;
  preview.value = null;
  fileName.value = f.name;
  try {
    parsed.value = await readJsonFile(f);
  } catch {
    error.value = "Dit bestand kan niet worden gelezen. Is het een voortgangsbestand van deze app?";
    return;
  }
  try {
    preview.value = await api.post<Preview>("/import/preview", { file: parsed.value });
  } catch (err) {
    error.value = (err as Error).message;
  }
}

async function apply() {
  busy.value = true;
  try {
    await api.post("/import/apply", { file: parsed.value });
    done.value = "Klaar! Je voortgang is samengevoegd.";
    preview.value = null;
    parsed.value = null;
    await refreshLast();
    emit("imported");
  } catch (err) {
    error.value = (err as Error).message;
  } finally {
    busy.value = false;
    if (input.value) input.value.value = "";
  }
}

async function undo() {
  try {
    await api.post("/import/undo");
    done.value = "De laatste import is ongedaan gemaakt.";
    await refreshLast();
    emit("imported");
  } catch (err) {
    error.value = (err as Error).message;
  }
}

const fmt = (iso: string) => new Date(iso).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" });
const changes = (p: Preview) => Object.entries(p.counts).filter(([, c]) => c.new || c.updated);
</script>

<template>
  <div>
    <input ref="input" type="file" accept="application/json,.json" class="sr-only" aria-label="Kies een voortgangsbestand" @change="pick" />
    <AppButton variant="secondary" @click="input?.click()">📂 Ga verder met een bestand</AppButton>
    <p class="mt-1 text-sm text-muted">Kies het bestand dat je op je andere apparaat hebt bewaard. Ook een bestand van de oude versie van de app werkt.</p>

    <p v-if="error" role="alert" class="mt-3 rounded-2xl bg-bad-bg p-3 font-semibold text-bad">✗ {{ error }}</p>
    <p v-if="done" role="status" class="mt-3 rounded-2xl bg-good-bg p-3 font-semibold text-good">✓ {{ done }}</p>

    <div v-if="preview" class="slide-up mt-4 rounded-2xl border border-line p-4">
      <p class="font-bold">
        {{ fileName }}
        <span class="font-normal text-muted">· van {{ preview.from.legacy ? "de oude versie" : (preview.from.deviceName ?? "een ander apparaat") }}, bewaard op {{ fmt(preview.from.exportedAt) }}</span>
      </p>
      <p v-if="preview.nothingNew" class="mt-2 font-semibold text-good">✓ Hier staat niets nieuws in. Alles zit al op dit apparaat.</p>
      <template v-else>
        <p class="mt-2">Dit wordt toegevoegd:</p>
        <ul class="mt-1 grid gap-0.5">
          <li v-for="[key, c] in changes(preview)" :key="key">
            <strong>{{ c.new + c.updated }}</strong> {{ label(key, c.new + c.updated) }}
            <span v-if="c.updated" class="text-muted">({{ c.new }} nieuw, {{ c.updated }} bijgewerkt)</span>
          </li>
          <li v-if="preview.settingsReplaced">Je instellingen van het andere apparaat (nieuwer)</li>
          <li v-if="preview.lastLocationReplaced">“Verder waar ik was” springt naar de plek van het andere apparaat</li>
        </ul>
        <p class="mt-2 text-sm text-muted">Er wordt niets verwijderd. Nieuwere gegevens op dit apparaat blijven staan.</p>
      </template>
      <p v-if="preview.contentChanged" class="mt-2 rounded-xl bg-brand-bg p-2 text-sm font-semibold text-brand-strong">
        Dit bestand is gemaakt met een andere versie van de cursus.<template v-if="preview.unknownItems"> {{ preview.unknownItems }} onderdelen bestaan hier niet meer en worden niet getoond.</template>
      </p>
      <div class="mt-3 flex flex-wrap gap-3">
        <AppButton :disabled="busy || preview.nothingNew" @click="apply">Samenvoegen</AppButton>
        <AppButton variant="ghost" @click="preview = null">Annuleren</AppButton>
      </div>
    </div>

    <p v-if="last" class="mt-3 text-sm text-muted">
      Laatste import: {{ fmt(last.at) }}<template v-if="last.from"> (van {{ last.from }})</template>.
      <button type="button" class="font-semibold underline hover:text-ink" @click="undo">Maak ongedaan</button>
    </p>
  </div>
</template>
