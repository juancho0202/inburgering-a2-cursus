<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { RouterLink } from "vue-router";
import { api } from "../api/client";
import { useSettingsStore } from "../stores/settings";
import { skillEmoji, skillLabel } from "../lib/examLabels";
import { dayString } from "@shared/logic/srs";
import { EXAM_SKILLS, type ExamDates } from "@shared/logic/studyPlan";
import AppButton from "./ui/AppButton.vue";

// "Wanneer is je examen?" on the end screen of a lesson or mock exam. The service decides whether it is due
// (a few times, days apart); asking counts as one time, so this is asked once per mount.
const store = useSettingsStore();
const show = ref(false);
const dates = reactive<ExamDates>({});
const neverAgain = ref(false);
const saved = ref(false);
const error = ref<string | null>(null);
const busy = ref(false);
const today = dayString(new Date());
const filled = computed(() => Object.fromEntries(Object.entries(dates).filter(([, d]) => d)) as ExamDates);

onMounted(async () => {
  try {
    show.value = (await api.post<{ show: boolean }>("/exam-prompt")).show;
  } catch {
    // Only a suggestion: without an answer the end screen is complete as it is.
  }
});

async function save() {
  busy.value = true;
  try {
    await store.update({ examDates: filled.value });
    saved.value = true;
  } catch {
    error.value = "De datum kon niet worden opgeslagen. Probeer het nog een keer.";
  } finally {
    busy.value = false;
  }
}

async function later() {
  error.value = null;
  if (neverAgain.value) {
    busy.value = true;
    try {
      await api.post("/exam-prompt/stop");
    } catch {
      error.value = "Dit kon niet worden opgeslagen. Probeer het nog een keer.";
      return;
    } finally {
      busy.value = false;
    }
  }
  show.value = false;
}
</script>

<template>
  <section v-if="show" class="rounded-2xl border-2 border-brand/40 bg-brand-bg p-5 text-left" aria-labelledby="exam-date-card-title">
    <template v-if="saved">
      <p id="exam-date-card-title" role="status" class="font-bold">✓ Opgeslagen. Je studieplan staat op de startpagina.</p>
      <RouterLink to="/" class="mt-2 inline-block font-semibold underline">Naar mijn studieplan</RouterLink>
    </template>
    <template v-else>
      <h2 id="exam-date-card-title" class="text-lg font-bold"><span aria-hidden="true">📅</span> Wanneer is je examen?</h2>
      <p class="mt-1 text-muted">Vul de datum in. Dan maakt de app een studieplan voor je. Weet je het nog niet? Dat is goed: kies Later.</p>
      <div class="mt-3 grid gap-3 sm:grid-cols-2">
        <label v-for="skill in EXAM_SKILLS" :key="skill" class="block">
          <span class="font-semibold"><span aria-hidden="true">{{ skillEmoji[skill] }}</span> {{ skillLabel[skill] }}</span>
          <input v-model="dates[skill]" class="input mt-1" type="date" :min="today" />
        </label>
      </div>
      <label class="mt-4 flex items-center gap-3">
        <input v-model="neverAgain" type="checkbox" class="h-5 w-5 accent-[var(--brand)]" />
        Niet meer vragen
      </label>
      <p v-if="error" role="alert" class="mt-3 font-semibold text-bad">✗ {{ error }}</p>
      <div class="mt-4 flex flex-wrap gap-3">
        <AppButton :disabled="busy || !Object.keys(filled).length" @click="save">Opslaan</AppButton>
        <AppButton variant="secondary" :disabled="busy" @click="later">Later</AppButton>
      </div>
    </template>
  </section>
</template>
