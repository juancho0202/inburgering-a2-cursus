<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { api } from "../api/client";
import { newIssueUrl } from "../lib/github";
import AppButton from "./ui/AppButton.vue";

const props = defineProps<{ itemId: string; label?: string }>();

interface Target {
  itemId: string;
  source: { file: string; title: string } | null;
}

const open = ref(false);
const note = ref("");
/** "github": the issue page was opened; "saved": the note is kept on this device. */
const sent = ref<"github" | "saved" | null>(null);
const error = ref<string | null>(null);
const target = ref<Target | null>(null);
const field = ref<HTMLTextAreaElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);

// Items outside data/course (exercises made by Claude) have no file to report on, so they can only be saved here.
const issueUrl = computed(() => {
  const source = target.value?.source;
  return source ? newIssueUrl({ itemId: props.itemId, ...source, note: note.value }) : null;
});

async function show() {
  open.value = true;
  sent.value = null;
  error.value = null;
  note.value = "";
  await nextTick();
  field.value?.focus();
  try {
    target.value = await api.get<Target>(`/flags/target/${encodeURIComponent(props.itemId)}`);
  } catch {
    target.value = null;
  }
}
function close() {
  open.value = false;
  nextTick(() => trigger.value?.focus());
}
async function save() {
  error.value = null;
  try {
    await api.post("/flags", { itemId: props.itemId, note: note.value });
    sent.value = "saved";
  } catch (e) {
    error.value = (e as Error).message;
  }
}
</script>

<template>
  <button
    ref="trigger"
    type="button"
    class="inline-flex items-center gap-1.5 rounded-xl border border-flag/40 px-3 py-1.5 text-sm font-semibold text-muted transition hover:border-flag hover:bg-flag-bg hover:text-flag"
    @click="show"
  >
    <span aria-hidden="true" class="text-flag">⚑</span> {{ label ?? "Meld een fout" }}
  </button>

  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-[70] grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="report-title" @keydown.esc="close">
      <div class="card w-full max-w-md p-6">
        <h2 id="report-title" class="text-xl font-extrabold">Meld een fout</h2>
        <template v-if="!sent">
          <p v-if="issueUrl" class="mt-1 text-muted">
            Klopt er iets niet in deze les of vraag? Schrijf kort wat er mis is. Je melding wordt een openbaar issue op GitHub, zodat iedereen kan zien dat het
            wordt opgelost. Daarvoor heb je een gratis GitHub-account nodig.
          </p>
          <p v-else class="mt-1 text-muted">Klopt er iets niet? Schrijf kort wat er mis is. Je melding wordt bewaard op dit apparaat.</p>
          <label for="report-note" class="mt-4 block font-semibold">Wat klopt niet?</label>
          <textarea id="report-note" ref="field" v-model="note" rows="4" maxlength="500" class="input mt-1" placeholder="Bijvoorbeeld: er zijn twee goede antwoorden." />
          <p v-if="error" role="alert" class="mt-2 font-semibold text-bad">✗ {{ error }}</p>
          <div class="mt-4 flex flex-wrap justify-end gap-3">
            <AppButton variant="secondary" @click="close">Annuleren</AppButton>
            <a v-if="issueUrl" :href="issueUrl" target="_blank" rel="noopener noreferrer" @click="sent = 'github'">
              <AppButton tabindex="-1">Melden op GitHub ↗</AppButton>
            </a>
            <AppButton v-else @click="save">Bewaar melding</AppButton>
          </div>
          <p v-if="issueUrl" class="mt-3 text-sm text-muted">
            Geen GitHub-account?
            <button type="button" class="font-semibold underline hover:text-ink" @click="save">Bewaar de melding op dit apparaat</button>
            en stuur later je voortgangsbestand.
          </p>
        </template>
        <template v-else-if="sent === 'github'">
          <p role="status" class="mt-3 rounded-2xl bg-good-bg p-3 font-semibold text-good">✓ GitHub is geopend in een nieuw tabblad.</p>
          <p class="mt-2 text-sm text-muted">Alles is al ingevuld. Klik daar op <strong>Create</strong> om de melding te versturen. Bedankt!</p>
          <div class="mt-4 flex justify-end"><AppButton @click="close">Sluiten</AppButton></div>
        </template>
        <template v-else>
          <p role="status" class="mt-3 rounded-2xl bg-good-bg p-3 font-semibold text-good">✓ Bedankt! Je melding is bewaard.</p>
          <p class="mt-2 text-sm text-muted">Je meldingen zitten in je voortgangsbestand. Stuur dat bestand naar degene die de cursus bijhoudt.</p>
          <div class="mt-4 flex justify-end"><AppButton @click="close">Sluiten</AppButton></div>
        </template>
      </div>
    </div>
  </Teleport>
</template>
