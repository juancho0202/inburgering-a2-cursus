<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
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

// The explanation of one correction, shown as a tooltip: on hover with a mouse, on tap, or on keyboard focus.
// A tap (or click) pins it until the next tap, its ✕, Escape, or a tap anywhere else; only one is open at a time.
const tip = ref<{ m: number; c: number; pinned: boolean } | null>(null);
const isOpen = (m: number, c: number) => tip.value?.m === m && tip.value.c === c;
const tipId = (m: number, c: number) => `taalcafe-tip-${m}-${c}`;
const chatBox = ref<HTMLElement | null>(null);
const tipBox = ref<HTMLElement | null>(null);
/** Where the tooltip goes, in px inside the chat: above the corrected chunk, the triangle pointing at its middle. */
const place = ref({ left: 0, top: 0, width: 0, arrow: 0 });
const GAP = 12; // room for the triangle
let leaveTimer: ReturnType<typeof setTimeout> | undefined;
// Closing gives the focus back to the correction; that focus must not open the tooltip again.
let refocusing = false;

const chunkEl = (m: number, c: number) => chatBox.value?.querySelector<HTMLElement>(`[data-fix="${m}-${c}"]`) ?? null;

/** Measures the chunk (its first line, when it wraps) and puts the tooltip above it, inside the chat column. */
function positionTip() {
  const box = chatBox.value;
  const t = tip.value;
  const chunk = t && chunkEl(t.m, t.c);
  if (!box || !chunk) return;
  const area = box.getBoundingClientRect();
  const first = chunk.getClientRects()[0] ?? chunk.getBoundingClientRect();
  // A phone gets (almost) the whole width: the page's own side margin is the padding. Wider screens: a card of 20rem.
  const narrow = window.innerWidth < 640;
  const width = narrow ? area.width : Math.min(320, area.width);
  const centre = first.left + first.width / 2 - area.left;
  const left = narrow ? 0 : Math.min(Math.max(centre - width / 2, 0), Math.max(area.width - width, 0));
  place.value = { left, width, top: first.top - area.top - GAP, arrow: Math.min(Math.max(centre - left, 16), Math.max(width - 16, 16)) };
}

/** A tooltip opened on purpose (tap, keyboard) must be readable: scroll up a little when its top is under the header or off screen. */
function revealTip() {
  const el = tipBox.value;
  if (!el) return;
  // The app's bar stays at the top of the screen (sticky): the tooltip must end up below it.
  const bars = Array.from(document.querySelectorAll("header")).filter((h) => ["sticky", "fixed"].includes(getComputedStyle(h).position));
  const covered = Math.max(0, ...bars.map((h) => h.getBoundingClientRect().bottom));
  const over = covered + 8 - el.getBoundingClientRect().top;
  if (over > 0) window.scrollBy({ top: -over, behavior: "smooth" });
}

async function open(m: number, c: number, pinned: boolean, reveal = pinned) {
  clearTimeout(leaveTimer);
  tip.value = { m, c, pinned };
  await nextTick();
  positionTip();
  if (reveal) {
    await nextTick();
    revealTip();
  }
}
function close(returnFocus = false) {
  const t = tip.value;
  clearTimeout(leaveTimer);
  tip.value = null;
  if (returnFocus && t) {
    refocusing = true;
    chunkEl(t.m, t.c)?.focus();
    refocusing = false;
  }
}

function hoverIn(e: PointerEvent, m: number, c: number) {
  // A finger also sends pointerenter: only a mouse opens on hover, a tap goes through onTap.
  if (e.pointerType !== "mouse" || tip.value?.pinned) return;
  open(m, c, false);
}
function hoverOut(e: PointerEvent) {
  if (e.pointerType !== "mouse" || !tip.value || tip.value.pinned) return;
  // A moment to move the mouse onto the tooltip (to its ✕) before it goes.
  clearTimeout(leaveTimer);
  leaveTimer = setTimeout(() => tip.value && !tip.value.pinned && close(), 200);
}
/** The mouse reached the tooltip: it stays, so its ✕ can be clicked. */
function keepTip() {
  clearTimeout(leaveTimer);
}
function onTap(m: number, c: number) {
  if (isOpen(m, c) && tip.value!.pinned) close();
  else open(m, c, true);
}
// Keyboard focus shows the tooltip (not pinned: it goes with the focus). A tap also focuses first, then its click pins it.
function onFocus(m: number, c: number) {
  if (!tip.value && !refocusing) open(m, c, false, true);
}
function onBlur(e: FocusEvent, m: number, c: number) {
  if (isOpen(m, c) && !tip.value!.pinned && !(e.relatedTarget as Element | null)?.closest?.("[data-tooltip]")) close();
}
function closeOnOutside(e: Event) {
  if (tip.value && !(e.target as Element | null)?.closest?.("[data-fix], [data-tooltip]")) close();
}
function closeOnEscape(e: KeyboardEvent) {
  if (e.key === "Escape" && tip.value) close(true);
}
onMounted(() => {
  document.addEventListener("click", closeOnOutside);
  document.addEventListener("keydown", closeOnEscape);
  window.addEventListener("resize", positionTip);
});
onBeforeUnmount(() => {
  clearTimeout(leaveTimer);
  document.removeEventListener("click", closeOnOutside);
  document.removeEventListener("keydown", closeOnEscape);
  window.removeEventListener("resize", positionTip);
});
const openCorrection = computed(() => {
  const t = tip.value;
  const m = t ? messages.value[t.m] : undefined;
  return t && m?.from === "learner" ? (m.corrections?.[t.c] ?? null) : null;
});

const learnerTurns = computed(() => messages.value.filter((m) => m.from === "learner").length);
const turnsLeft = computed(() => TAALCAFE_MAX_TURNS - learnerTurns.value);
const done = computed(() => turnsLeft.value <= 0);

function start(t: TaalcafeTopic) {
  conversation++;
  topic.value = t;
  messages.value = [{ from: "partner", text: t.opener }];
  close();
  draft.value = "";
  error.value = null;
  sending.value = false;
}

function reset() {
  conversation++;
  topic.value = null;
  messages.value = [];
  close();
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
/** Corrections that could not be placed in the text (overlapping ones): listed under the message, so none is lost. */
const unplaced = (m: Extract<Message, { from: "learner" }>) => {
  const shown = new Set(segmentsOf(m).flatMap((s) => (s.kind === "fix" ? [s.index] : [])));
  return (m.corrections ?? []).filter((_, i) => !shown.has(i));
};
const anyCorrections = computed(() => messages.value.some((m) => m.from === "learner" && m.corrections?.length));
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
      <div ref="chatBox" class="relative" data-chat>
      <ol class="grid gap-3" aria-live="polite" lang="nl" translate="no">
        <li v-for="(m, i) in messages" :key="i" class="flex" :class="m.from === 'learner' ? 'justify-end' : 'justify-start'">
          <div v-if="m.from === 'partner'" class="card max-w-[85%] p-3" data-from="partner">
            <p class="mb-1 flex items-center gap-2 text-sm font-bold text-muted">{{ TAALCAFE_PARTNER }} <SpeakButton :text="m.text" /></p>
            <p class="whitespace-pre-line text-lg">{{ m.text }}</p>
          </div>
          <div v-else class="relative max-w-[85%] rounded-2xl bg-brand-bg p-3" data-from="learner" :class="{ 'opacity-70': m.corrections === null }">
            <p class="whitespace-pre-line text-lg">
              <template v-for="(s, si) in segmentsOf(m)" :key="si">
                <span v-if="s.kind === 'text'">{{ s.text }}</span>
                <!-- display: inline, so a correction wraps with the sentence like the rest of the text -->
                <button
                  v-else
                  type="button"
                  :data-fix="`${i}-${s.index}`"
                  class="inline cursor-help rounded text-left focus-visible:outline-2 focus-visible:outline-brand"
                  :aria-expanded="isOpen(i, s.index)"
                  :aria-describedby="isOpen(i, s.index) ? tipId(i, s.index) : undefined"
                  @pointerenter="hoverIn($event, i, s.index)"
                  @pointerleave="hoverOut"
                  @focus="onFocus(i, s.index)"
                  @blur="onBlur($event, i, s.index)"
                  @click="onTap(i, s.index)"
                >
                  <del class="rounded bg-bad-bg px-0.5 text-bad line-through">{{ s.original }}</del>
                  <ins class="ml-1 rounded bg-good-bg px-0.5 font-semibold text-good underline decoration-dotted underline-offset-4">{{ s.corrected }}</ins>
                </button>
              </template>
            </p>
            <p v-if="m.corrections && !m.corrections.length" class="mt-1 text-sm font-semibold text-good">✓ {{ lang.feedback("taalcafe.good") }}</p>
            <ul v-else-if="m.corrections && unplaced(m).length" class="mt-2 grid gap-1 border-t border-line pt-2 text-sm">
              <li v-for="(c, ci) in unplaced(m)" :key="ci"><del class="text-bad">{{ c.original }}</del> → <strong class="text-good">{{ c.corrected }}</strong>: {{ c.explanation }}</li>
            </ul>
          </div>
        </li>
        <li v-if="sending" class="text-muted">{{ lang.t("taalcafe.typing") }}</li>
      </ol>
      <!-- One tooltip for the whole chat, placed above the chunk it explains (positionTip); its triangle points at that chunk.
           Not role=tooltip: it has a button (✕), so it is a small note the chunk refers to with aria-describedby. -->
      <div
        v-if="tip && openCorrection"
        :id="tipId(tip.m, tip.c)"
        ref="tipBox"
        data-tooltip
        class="card absolute z-20 -translate-y-full border-2 border-brand py-3 pl-4 pr-10 text-base shadow-lg"
        :style="{ left: `${place.left}px`, top: `${place.top}px`, width: place.width ? `${place.width}px` : undefined }"
        lang="nl"
        translate="no"
        @pointerenter="keepTip"
        @pointerleave="hoverOut"
      >
        <button
          type="button"
          class="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-full text-lg text-muted hover:bg-surface-2 hover:text-ink"
          :aria-label="lang.t('common.close')"
          @click="close(true)"
        >
          ✕
        </button>
        <p><del class="text-bad">{{ openCorrection.original }}</del> → <strong class="text-good">{{ openCorrection.corrected }}</strong></p>
        <p class="mt-1">{{ openCorrection.explanation }}</p>
        <!-- The triangle: a turned square with the card's colour and the border on its two lower sides -->
        <span
          class="absolute -bottom-[9px] h-4 w-4 -translate-x-1/2 rotate-45 border-b-2 border-r-2 border-brand bg-surface"
          :style="{ left: `${place.arrow}px` }"
          aria-hidden="true"
        />
      </div>
      </div>
      <div ref="end" />

      <p v-if="anyCorrections" class="mt-3 text-sm text-muted">ⓘ {{ lang.t("taalcafe.tapHint") }}</p>
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
