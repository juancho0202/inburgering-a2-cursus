<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { RouterLink } from "vue-router";
import type { WritingFeedback } from "@shared/schemas/claude";
import { buildSegments } from "@shared/logic/corrections";
import { TAALCAFE_MAX_LENGTH, TAALCAFE_MAX_TURNS, TAALCAFE_PARTNER, TAALCAFE_TOPICS, type TaalcafeTopic } from "@shared/logic/taalcafe";
import { api } from "../api/client";
import { useSettingsStore } from "../stores/settings";
import { useLanguageStore } from "../stores/language";
import AppButton from "../components/ui/AppButton.vue";
import SpeakButton from "../components/ui/SpeakButton.vue";
import UiLabel from "../components/ui/UiLabel.vue";

type Correction = WritingFeedback["corrections"][number];
type Message = { from: "partner"; text: string } | { from: "learner"; text: string; corrections: Correction[] | null };

const settings = useSettingsStore();
const lang = useLanguageStore();
if (!settings.settings) settings.load().catch(() => {});

const topic = ref<TaalcafeTopic | null>(null);
const messages = ref<Message[]>([]);
const draft = ref("");
const sending = ref(false);
const error = ref<string | null>(null);
const end = ref<HTMLElement | null>(null);
// Every new conversation gets a new number: an answer to a request from an earlier conversation is ignored.
let conversation = 0;

const learnerTurns = computed(() => messages.value.filter((m) => m.from === "learner").length);
const turnsLeft = computed(() => TAALCAFE_MAX_TURNS - learnerTurns.value);
const done = computed(() => turnsLeft.value <= 0);

function start(t: TaalcafeTopic) {
  conversation++;
  topic.value = t;
  messages.value = [{ from: "partner", text: t.opener }];
  draft.value = "";
  error.value = null;
  sending.value = false;
}

function reset() {
  conversation++;
  topic.value = null;
  messages.value = [];
  draft.value = "";
  error.value = null;
  sending.value = false;
}

async function scrollDown() {
  await nextTick();
  end.value?.scrollIntoView?.({ block: "end", behavior: "smooth" });
}

async function send() {
  const text = draft.value.trim();
  if (!topic.value || sending.value || done.value || !text) return;
  const mine = conversation;
  const history = messages.value.map((m) => ({ from: m.from, text: m.text }));
  messages.value.push({ from: "learner", text, corrections: null });
  // The reactive copy in the list, to fill in the corrections when they come.
  const mineMessage = messages.value[messages.value.length - 1] as Extract<Message, { from: "learner" }>;
  draft.value = "";
  error.value = null;
  sending.value = true;
  scrollDown();
  try {
    const res = await api.post<{ reply: string; corrections: Correction[] }>("/claude/taalcafe", { topicId: topic.value.id, history, message: text });
    if (mine !== conversation) return;
    mineMessage.corrections = res.corrections;
    messages.value.push({ from: "partner", text: res.reply });
  } catch (e) {
    if (mine !== conversation) return;
    // Nothing is lost: the message goes back into the box, to send again.
    messages.value.pop();
    draft.value = text;
    error.value = (e as Error).message;
  } finally {
    if (mine === conversation) sending.value = false;
  }
  scrollDown();
}

function onKey(e: KeyboardEvent) {
  if (e.key !== "Enter" || e.shiftKey || e.isComposing) return;
  e.preventDefault();
  send();
}

const segmentsOf = (m: Extract<Message, { from: "learner" }>) => buildSegments(m.text, m.corrections ?? []);
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <RouterLink to="/module/schrijven" class="text-muted hover:text-ink">← <UiLabel k="common.back" /></RouterLink>
    <div class="mb-4 mt-3 flex flex-wrap items-end justify-between gap-3">
      <h1 class="text-3xl font-extrabold tracking-tight">☕ <UiLabel variant="heading" k="taalcafe.title" /></h1>
      <AppButton v-if="topic" variant="secondary" @click="reset"><UiLabel k="taalcafe.newChat" /></AppButton>
    </div>
    <p class="mb-6 text-muted">{{ lang.t("taalcafe.intro") }}</p>

    <div v-if="settings.settings && !settings.hasKey" class="card p-5">
      <p>
        {{ lang.t("taalcafe.noKey") }}
        <RouterLink to="/instellingen" class="font-semibold text-brand-strong underline"><UiLabel variant="inline" k="nav.settings" /></RouterLink>.
      </p>
    </div>

    <section v-else-if="!topic">
      <h2 class="mb-3 text-xl font-bold"><UiLabel variant="heading" k="taalcafe.choose" /></h2>
      <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2" lang="nl" translate="no">
        <li v-for="t in TAALCAFE_TOPICS" :key="t.id">
          <button type="button" class="card flex w-full items-center gap-3 p-4 text-left font-bold transition hover:-translate-y-0.5 hover:shadow-lg" @click="start(t)">
            <span class="text-2xl" aria-hidden="true">{{ t.emoji }}</span>{{ t.title }}
          </button>
        </li>
      </ul>
    </section>

    <section v-else :aria-label="lang.t('taalcafe.title')">
      <p class="mb-3 text-sm font-semibold text-muted"><UiLabel variant="inline" k="taalcafe.topic" />: <span lang="nl" translate="no">{{ topic.title }}</span></p>
      <ol class="grid gap-3" aria-live="polite" lang="nl" translate="no">
        <li v-for="(m, i) in messages" :key="i" class="flex" :class="m.from === 'learner' ? 'justify-end' : 'justify-start'">
          <div v-if="m.from === 'partner'" class="card max-w-[85%] p-3" data-from="partner">
            <p class="mb-1 flex items-center gap-2 text-sm font-bold text-muted">{{ TAALCAFE_PARTNER }} <SpeakButton :text="m.text" /></p>
            <p class="whitespace-pre-line text-lg">{{ m.text }}</p>
          </div>
          <div v-else class="max-w-[85%] rounded-2xl bg-brand-bg p-3" data-from="learner" :class="{ 'opacity-70': m.corrections === null }">
            <p class="whitespace-pre-line text-lg">
              <template v-for="(s, si) in segmentsOf(m)" :key="si">
                <span v-if="s.kind === 'text'">{{ s.text }}</span>
                <span v-else
                  ><del class="rounded bg-bad-bg px-0.5 text-bad line-through">{{ s.original }}</del>
                  <ins class="ml-1 rounded bg-good-bg px-0.5 font-semibold text-good no-underline">{{ s.corrected }}</ins></span
                >
              </template>
            </p>
            <p v-if="m.corrections && !m.corrections.length" class="mt-1 text-sm font-semibold text-good">✓ {{ lang.feedback("taalcafe.good") }}</p>
            <ul v-else-if="m.corrections" class="mt-2 grid gap-1 border-t border-line pt-2 text-sm">
              <li v-for="(c, ci) in m.corrections" :key="ci"><del class="text-bad">{{ c.original }}</del> → <strong class="text-good">{{ c.corrected }}</strong>: {{ c.explanation }}</li>
            </ul>
          </div>
        </li>
        <li v-if="sending" class="text-muted">{{ lang.t("taalcafe.typing") }}</li>
      </ol>
      <div ref="end" />

      <p v-if="error" class="mt-4 rounded-2xl bg-bad-bg p-4 text-bad" role="alert">✗ {{ error }}</p>
      <p v-if="done" class="card mt-4 p-4 font-semibold">{{ lang.t("taalcafe.done") }}</p>
      <form v-else class="mt-4 grid gap-2" @submit.prevent="send">
        <label for="taalcafe-message" class="sr-only">{{ lang.t("taalcafe.message") }}</label>
        <textarea
          id="taalcafe-message"
          v-model="draft"
          rows="3"
          :maxlength="TAALCAFE_MAX_LENGTH"
          lang="nl"
          :spellcheck="settings.settings?.spellcheckWriting ?? false"
          class="input text-lg"
          :placeholder="lang.t('taalcafe.placeholder')"
          @keydown="onKey"
        />
        <div class="flex flex-wrap items-center justify-between gap-2">
          <span class="text-sm text-muted">{{ lang.t("taalcafe.keys") }}<template v-if="turnsLeft <= 5"> · {{ lang.t("taalcafe.turnsLeft", { n: turnsLeft }) }}</template></span>
          <AppButton :disabled="sending || !draft.trim()" @click="send"><UiLabel :k="error ? 'taalcafe.retry' : 'taalcafe.send'" /></AppButton>
        </div>
      </form>
    </section>
  </div>
</template>
