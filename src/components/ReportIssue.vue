<script setup lang="ts">
import { nextTick, ref } from "vue";
import { api } from "../api/client";
import AppButton from "./ui/AppButton.vue";

const props = defineProps<{ itemId: string; label?: string }>();

const open = ref(false);
const note = ref("");
const sent = ref(false);
const error = ref<string | null>(null);
const field = ref<HTMLTextAreaElement | null>(null);
const trigger = ref<HTMLButtonElement | null>(null);

async function show() {
  open.value = true;
  sent.value = false;
  error.value = null;
  note.value = "";
  await nextTick();
  field.value?.focus();
}
function close() {
  open.value = false;
  nextTick(() => trigger.value?.focus());
}
async function send() {
  error.value = null;
  try {
    await api.post("/flags", { itemId: props.itemId, note: note.value });
    sent.value = true;
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
          <p class="mt-1 text-muted">Klopt er iets niet in deze les of vraag? Schrijf kort wat er mis is. Je melding wordt bewaard op dit apparaat.</p>
          <label for="report-note" class="mt-4 block font-semibold">Wat klopt niet?</label>
          <textarea id="report-note" ref="field" v-model="note" rows="4" maxlength="500" class="input mt-1" placeholder="Bijvoorbeeld: er zijn twee goede antwoorden." />
          <p v-if="error" role="alert" class="mt-2 font-semibold text-bad">✗ {{ error }}</p>
          <div class="mt-4 flex justify-end gap-3">
            <AppButton variant="secondary" @click="close">Annuleren</AppButton>
            <AppButton @click="send">Verstuur melding</AppButton>
          </div>
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
