<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useSettingsStore } from "../stores/settings";
import { api } from "../api/client";
import ImportSection from "../components/ImportSection.vue";
import KeyGuide from "../components/KeyGuide.vue";
import InstallHint from "../components/InstallHint.vue";
import { useSessionStore } from "../stores/session";
import { MODELS } from "@shared/claude/models";
import AppButton from "../components/ui/AppButton.vue";
import { useSpeech } from "../composables/useSpeech";
import { playComplete, playCorrect, playLessonMelody, playWrong } from "../lib/sound";
import LanguagePicker from "../components/LanguagePicker.vue";
import UiLabel from "../components/ui/UiLabel.vue";
import UiText from "../components/ui/UiText.vue";
import { useLanguageStore } from "../stores/language";

const store = useSettingsStore();
const session = useSessionStore();
const lang = useLanguageStore();
const newKey = ref("");
const saved = ref(false);
const resetText = ref("");
const resetMessage = ref<{ ok: boolean; text: string } | null>(null);

async function resetProgress() {
  try {
    await api.post("/progress/reset", { confirm: resetText.value });
    resetText.value = "";
    resetMessage.value = { ok: true, text: lang.t("settings.resetDone") };
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
const speech = useSpeech();
// Module names: course content, so Dutch.
const tryModules = ["Basis", "Lezen", "KNM", "Schrijven", "Examens"];
const tryModule = ref(0);
const tryLesson = ref(1);
const soundOptions = [
  { key: "voiceAnnouncements", label: "settings.voice", hint: "settings.voiceHint" },
  { key: "soundEffects", label: "settings.effects", hint: "settings.effectsHint" },
  { key: "lessonMusic", label: "settings.melody", hint: "settings.melodyHint" },
] as const;
/** "Geen geluid": on when all three are off; switching it sets all three at once. */
const silent = computed(() => soundOptions.every((o) => store.settings?.[o.key] === false));
const setSilent = (off: boolean) => patch({ voiceAnnouncements: !off, soundEffects: !off, lessonMusic: !off });
const themes = [
  { value: "system", label: "settings.themeAuto" },
  { value: "light", label: "settings.themeLight" },
  { value: "dark", label: "settings.themeDark" },
] as const;
// How much of the app's own text is Dutch (see the language store). The examples show the "Next" button at each level.
const levels = [0, 1, 2, 3] as const;
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-3xl font-extrabold tracking-tight"><UiLabel k="nav.settings" /></h1>
      <span v-if="saved" role="status" class="rounded-full bg-good-bg px-3 py-1 text-sm font-bold text-good">✓ {{ lang.t("settings.saved") }}</span>
    </div>

    <div v-if="store.settings" class="grid gap-6">
      <section class="card p-6">
        <LanguagePicker />
        <template v-if="!lang.isDutch">
          <h2 id="immersion-title" class="mt-6 text-xl font-bold"><UiLabel k="settings.immersion" /></h2>
          <p class="mt-1 text-sm text-muted"><UiText k="settings.immersionHint" /></p>
          <div class="mt-3 grid gap-2" role="radiogroup" aria-labelledby="immersion-title">
            <button
              v-for="l in levels"
              :key="l"
              type="button"
              role="radio"
              :aria-checked="lang.immersion === l"
              class="rounded-2xl border-2 px-4 py-2.5 text-left transition"
              :class="lang.immersion === l ? 'border-brand bg-brand-bg' : 'border-line hover:border-brand'"
              @click="patch({ immersion: l })"
            >
              <span class="font-bold">{{ lang.t(`settings.level${l}`) }}</span>
              <span class="block text-sm text-muted">{{ lang.t(`settings.level${l}Hint`) }}</span>
            </button>
          </div>
          <label class="mt-4 flex items-start gap-3">
            <input type="checkbox" class="mt-1 h-5 w-5 shrink-0 accent-[var(--brand)]" :checked="store.settings.feedbackInMyLanguage" @change="patch({ feedbackInMyLanguage: ($event.target as HTMLInputElement).checked })" />
            <span><span class="font-semibold">{{ lang.t("settings.feedbackOwn") }}</span><span class="block text-sm text-muted">{{ lang.t("settings.feedbackOwnHint") }}</span></span>
          </label>
        </template>
      </section>

      <section class="card p-6">
        <h2 class="text-xl font-bold"><UiLabel k="settings.appearance" /></h2>
        <div class="mt-3 grid grid-cols-3 gap-2" role="radiogroup" :aria-label="lang.t('settings.theme')">
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
            <UiLabel :k="t.label" />
          </button>
        </div>
      </section>

      <section class="card p-6">
        <h2 class="text-xl font-bold"><UiLabel k="settings.sound" /></h2>
        <div class="mt-3 grid gap-3">
          <label class="flex items-start gap-3 border-b border-line pb-3">
            <input type="checkbox" class="mt-1 h-5 w-5 shrink-0 accent-[var(--brand)]" :checked="silent" @change="setSilent(($event.target as HTMLInputElement).checked)" />
            <span><span class="font-semibold">🔇 {{ lang.t("settings.silent") }}</span><span class="block text-sm text-muted">{{ lang.t("settings.silentHint") }}</span></span>
          </label>
          <label v-for="o in soundOptions" :key="o.key" class="flex items-start gap-3">
            <input type="checkbox" class="mt-1 h-5 w-5 shrink-0 accent-[var(--brand)]" :checked="store.settings[o.key]" @change="patch({ [o.key]: ($event.target as HTMLInputElement).checked })" />
            <span><span class="font-semibold">{{ lang.t(o.label) }}</span><span class="block text-sm text-muted">{{ lang.t(o.hint) }}</span></span>
          </label>
          <div class="mt-1 flex flex-wrap items-center gap-2" :aria-label="lang.t('settings.trySounds')">
            <AppButton variant="secondary" @click="playCorrect()">▶ <UiLabel k="settings.soundGood" /></AppButton>
            <AppButton variant="secondary" @click="playWrong()">▶ <UiLabel k="settings.soundWrong" /></AppButton>
            <AppButton variant="secondary" @click="playComplete(true)">▶ <UiLabel k="settings.soundDone" /></AppButton>
            <select v-model.number="tryModule" class="input w-auto py-2" :aria-label="lang.t('settings.module')">
              <option v-for="(m, i) in tryModules" :key="m" :value="i">{{ m }}</option>
            </select>
            <select v-model.number="tryLesson" class="input w-auto py-2" :aria-label="lang.t('settings.lesson')">
              <option v-for="n in 16" :key="n" :value="n">{{ lang.t("settings.lessonN", { n }) }}</option>
            </select>
            <AppButton variant="secondary" @click="playLessonMelody(tryLesson, tryModule)">▶ <UiLabel k="settings.melodyButton" /></AppButton>
          </div>
          <p v-if="speech.ready.value && !speech.available.value" class="text-sm text-muted">{{ lang.t("settings.noVoice") }}</p>
        </div>
      </section>

      <section class="card p-6">
        <h2 class="text-xl font-bold"><UiLabel k="nav.learn" /></h2>
        <div class="mt-3 grid gap-4 sm:grid-cols-2">
          <label class="block"><span class="font-semibold">{{ lang.t("settings.minutesPerDay") }}</span>
            <input class="input mt-1" type="number" min="5" max="240" :value="store.settings.dailyGoalMinutes" @change="patch({ dailyGoalMinutes: num($event) })" /></label>
          <label class="block"><span class="font-semibold">{{ lang.t("settings.newPerDay") }}</span>
            <input class="input mt-1" type="number" min="1" max="100" :value="store.settings.newCardsPerDay" @change="patch({ newCardsPerDay: num($event) })" /></label>
          <label class="block"><span class="font-semibold">{{ lang.t("settings.speechRate", { rate: store.settings.speechRate }) }}</span>
            <input class="mt-3 w-full accent-[var(--brand)]" type="range" min="0.6" max="1.2" step="0.05" :value="store.settings.speechRate" @change="patch({ speechRate: num($event) })" /></label>
          <label class="flex items-center gap-3 self-end pb-2 font-semibold">
            <input type="checkbox" class="h-5 w-5 accent-[var(--brand)]" :checked="store.settings.spellcheckWriting" @change="patch({ spellcheckWriting: ($event.target as HTMLInputElement).checked })" />
            {{ lang.t("settings.spellcheck") }}
          </label>
        </div>
      </section>

      <section class="card p-6">
        <h2 class="text-xl font-bold"><UiLabel k="settings.myData" /></h2>
        <p class="mt-1 text-muted"><UiText k="settings.myDataHint" /></p>
        <div class="mt-4 grid gap-5">
          <div>
            <AppButton variant="secondary" @click="session.openFinish()">🌙 <UiLabel k="settings.finishSave" /></AppButton>
            <p class="mt-1 text-sm text-muted"><UiText k="settings.finishSaveHint" /></p>
          </div>
          <ImportSection @imported="store.load()" />
        </div>

        <div class="mt-6 rounded-2xl border border-bad/40 bg-bad-bg p-4">
          <h3 class="font-bold text-bad"><UiLabel k="settings.reset" /></h3>
          <p class="mt-1"><UiText k="settings.resetHint" /></p>
          <label for="reset" class="mt-3 block font-semibold"><UiText k="settings.resetConfirm" md /></label>
          <input id="reset" v-model="resetText" class="input mt-1" autocomplete="off" />
          <AppButton class="mt-3" variant="bad" :disabled="resetText !== 'RESET'" @click="resetProgress"><UiLabel k="settings.resetButton" /></AppButton>
          <p v-if="resetMessage" role="status" class="mt-3 font-semibold" :class="resetMessage.ok ? 'text-good' : 'text-bad'">{{ resetMessage.ok ? "✓" : "✗" }} {{ resetMessage.text }}</p>
        </div>
      </section>

      <InstallHint />

      <section v-if="flags.length" class="card p-6">
        <h2 class="text-xl font-bold"><UiLabel k="settings.flags" :params="{ n: flags.length }" /></h2>
        <p class="mt-1 text-sm text-muted"><UiText k="settings.flagsHint" /></p>
        <ul class="mt-3 grid gap-2">
          <li v-for="f in flags" :key="f.id" class="flex items-start justify-between gap-3 rounded-2xl bg-surface-2 p-3">
            <div class="min-w-0">
              <p class="truncate font-semibold">{{ f.title }}</p>
              <p class="text-muted">{{ f.note || lang.t("settings.noNote") }}</p>
            </div>
            <button type="button" class="shrink-0 text-sm font-semibold underline hover:text-ink" @click="removeFlag(f.id)"><UiLabel k="settings.remove" /></button>
          </li>
        </ul>
      </section>

      <section class="card p-6">
        <h2 class="text-xl font-bold"><UiLabel k="settings.claude" /></h2>
        <p class="mt-1 text-muted"><UiText k="settings.claudeHint" /></p>
        <p class="mt-3">{{ lang.t("settings.currentKey") }} <strong>{{ store.settings.apiKey ?? lang.t("settings.noKey") }}</strong></p>

        <label for="apiKey" class="mt-4 block font-semibold">{{ lang.t(store.settings.apiKey ? "settings.newKey" : "settings.pasteKey") }}</label>
        <input id="apiKey" v-model="newKey" class="input mt-1" type="password" placeholder="sk-ant-..." autocomplete="off" spellcheck="false" @keydown.enter="saveKey" />
        <p v-if="keyError" role="alert" class="mt-2 font-semibold text-bad">✗ {{ keyError }}</p>
        <div class="mt-3 flex flex-wrap gap-3">
          <AppButton :disabled="!newKey.trim()" @click="saveKey"><UiLabel k="settings.saveAndTest" /></AppButton>
          <AppButton v-if="store.settings.apiKey" variant="secondary" @click="store.testKey"><UiLabel k="settings.testKey" /></AppButton>
          <AppButton v-if="store.settings.apiKey && !confirmRemove" variant="ghost" @click="confirmRemove = true"><UiLabel k="settings.removeKey" /></AppButton>
        </div>
        <div v-if="confirmRemove" class="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-bad-bg p-3">
          <span class="font-semibold">{{ lang.t("settings.removeKeyQuestion") }}</span>
          <AppButton variant="bad" @click="removeKey"><UiLabel k="settings.removeKeyYes" /></AppButton>
          <AppButton variant="secondary" @click="confirmRemove = false"><UiLabel k="settings.no" /></AppButton>
        </div>
        <p v-if="store.testResult" role="status" class="mt-3 font-semibold" :class="store.testResult.ok ? 'text-good' : 'text-bad'">
          {{ store.testResult.ok ? "✓" : "✗" }} {{ store.testResult.message }}
        </p>

        <label for="model" class="mt-5 block font-semibold">{{ lang.t("settings.model") }}</label>
        <select id="model" class="input mt-1" :value="store.settings.model" @change="patch({ model: ($event.target as HTMLSelectElement).value })">
          <option v-for="m in MODELS" :key="m.id" :value="m.id">{{ m.label }}</option>
        </select>

        <p v-if="store.settings.usage" class="mt-4 text-sm text-muted">
          {{
            lang.t(
              "settings.usage",
              { n: store.settings.usage.requests, tokensIn: store.settings.usage.inputTokens.toLocaleString(lang.proseLocale), tokensOut: store.settings.usage.outputTokens.toLocaleString(lang.proseLocale) },
              store.settings.usage.requests,
            )
          }}
        </p>
        <KeyGuide class="mt-4" />
      </section>
    </div>
    <p v-else class="text-muted">{{ lang.t("common.loading") }}</p>
  </div>
</template>
