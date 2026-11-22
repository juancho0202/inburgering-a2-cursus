<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink } from "vue-router";
import type { WritingFeedback } from "@shared/schemas/claude";
import { buildSegments } from "@shared/logic/corrections";
import { TAALCAFE_MAX_LENGTH, TAALCAFE_MAX_TURNS, TAALCAFE_PARTNER } from "@shared/logic/taalcafe";
import { WORDS_SHOWN, topicLevels, wordsUsed, type TopicWord } from "@shared/logic/taalcafeWords";
import { api } from "../api/client";
import { useSettingsStore } from "../stores/settings";
import { useLanguageStore } from "../stores/language";
import AppButton from "../components/ui/AppButton.vue";
import SpeakButton from "../components/ui/SpeakButton.vue";
import UiLabel from "../components/ui/UiLabel.vue";
import TaalcafePicker, { type TaalcafeTalk } from "../components/TaalcafePicker.vue";

type Correction = WritingFeedback["corrections"][number];
type Message = { from: "partner"; text: string } | { from: "learner"; text: string; corrections: Correction[] | null };

const settings = useSettingsStore();
const lang = useLanguageStore();
if (!settings.settings) settings.load().catch(() => {});

/** The conversation: a topic with Sanne, or a situation with a partner and a mission. */
const talk = ref<TaalcafeTalk | null>(null);
/** Situation goals reached so far (the server keeps them reached). */
const reached = ref<string[]>([]);
const messages = ref<Message[]>([]);
const draft = ref("");
const sending = ref(false);
const error = ref<string | null>(null);
const end = ref<HTMLElement | null>(null);

/** Word levels won per topic (saved). Without them (an error) every topic simply starts at level 1. */
const levels = ref<Record<string, number>>({});
api
  .get<{ levels: Record<string, number> }>("/taalcafe/levels")
  .then((r) => (levels.value = { ...r.levels, ...levels.value }))
  .catch(() => {});
// The word mission of a topic: a few places on screen, each with a word to use; a used word makes room for the next.
const places = ref<(TopicWord | null)[]>([]);
let waiting: TopicWord[] = [];
const wordsDone = ref(0);
/** For a screen reader: which word just counted. */
const wordNews = ref("");
const saveError = ref(false);
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

const situation = computed(() => (talk.value?.kind === "situation" ? talk.value.situation : null));
const topicTalk = computed(() => (talk.value?.kind === "topic" ? talk.value : null));
const topicLevel = computed(() => (topicTalk.value ? topicLevels(topicTalk.value.topic.id)[topicTalk.value.level] : null));
const levelCount = computed(() => (topicTalk.value ? topicLevels(topicTalk.value.topic.id).length : 0));
/** Every word of the level used: the level is won. */
const levelWon = computed(() => !!topicLevel.value && wordsDone.value >= topicLevel.value.words.length);
const hasNextLevel = computed(() => !!topicTalk.value && topicTalk.value.level + 1 < levelCount.value);
const partnerName = computed(() => situation.value?.partner.name ?? TAALCAFE_PARTNER);
const learnerTurns = computed(() => messages.value.filter((m) => m.from === "learner").length);
const turnsLeft = computed(() => TAALCAFE_MAX_TURNS - learnerTurns.value);
/** Every goal of the mission reached: the situation is over. */
const missionDone = computed(() => !!situation.value && situation.value.goals.every((g) => reached.value.includes(g.id)));
const done = computed(() => turnsLeft.value <= 0 || missionDone.value);

function begin(t: TaalcafeTalk | null) {
  conversation++;
  talk.value = t;
  const lv = t?.kind === "topic" ? topicLevels(t.topic.id)[t.level] : undefined;
  const opener = t ? (t.kind === "topic" ? (lv?.opener ?? t.topic.opener) : t.situation.opener) : null;
  messages.value = opener ? [{ from: "partner", text: opener }] : [];
  reached.value = [];
  places.value = lv ? lv.words.slice(0, WORDS_SHOWN) : [];
  waiting = lv ? lv.words.slice(WORDS_SHOWN) : [];
  wordsDone.value = 0;
  wordNews.value = "";
  saveError.value = false;
  close();
  draft.value = "";
  error.value = null;
  sending.value = false;
}
const reset = () => begin(null);
const again = () => begin(talk.value);
const nextLevel = () => topicTalk.value && begin({ ...topicTalk.value, level: topicTalk.value.level + 1 });

/**
 * The words of this message that count: the ones on screen, and also words of the level still waiting (those are
 * done before they show up). A used word on screen makes room for the next one. The last one wins the level.
 */
function useWords(text: string, corrections: Correction[]) {
  const on = places.value.filter((w): w is TopicWord => !!w);
  const used = wordsUsed(text, corrections, [...on, ...waiting]);
  if (!used.length) return;
  waiting = waiting.filter((w) => !used.includes(w));
  places.value = places.value.map((w) => (w && used.includes(w) ? (waiting.shift() ?? null) : w));
  wordsDone.value += used.length;
  wordNews.value = lang.t("taalcafe.wordUsed", { words: used.map((w) => w.word).join(", ") });
  if (levelWon.value) saveLevel();
}

async function saveLevel() {
  const t = topicTalk.value!;
  const mine = conversation;
  const level = t.level + 1;
  levels.value = { ...levels.value, [t.topic.id]: Math.max(levels.value[t.topic.id] ?? 0, level) };
  try {
    await api.post("/taalcafe/levels", { topicId: t.topic.id, level });
  } catch {
    // Won all the same; it is just not kept for next time.
    if (mine === conversation) saveError.value = true;
  }
}

async function scrollDown() {
  await nextTick();
  end.value?.scrollIntoView?.({ block: "end", behavior: "smooth" });
}

async function send() {
  const text = draft.value.trim();
  const current = talk.value;
  if (!current || sending.value || done.value || !text) return;
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
    const words = places.value.flatMap((w) => (w ? [w.word] : []));
    const which = current.kind === "topic" ? { topicId: current.topic.id, words } : { situationId: current.situation.id, reached: reached.value };
    const res = await api.post<{ reply: string; corrections: Correction[]; goalsReached?: string[] }>("/claude/taalcafe", { ...which, history, message: text });
    if (mine !== conversation) return;
    mineMessage.corrections = res.corrections;
    messages.value.push({ from: "partner", text: res.reply });
    if (res.goalsReached) reached.value = res.goalsReached;
    if (current.kind === "topic") useWords(text, res.corrections);
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
    <RouterLink to="/" class="text-muted hover:text-ink">← <UiLabel k="common.back" /></RouterLink>
    <div class="mb-4 mt-3 flex flex-wrap items-end justify-between gap-3">
      <h1 class="text-3xl font-extrabold tracking-tight">☕ <UiLabel variant="heading" k="taalcafe.title" /></h1>
      <AppButton v-if="talk" variant="secondary" @click="reset"><UiLabel k="taalcafe.newChat" /></AppButton>
    </div>
    <p class="mb-6 text-muted">{{ lang.t("taalcafe.intro") }}</p>

    <div v-if="settings.settings && !settings.hasKey" class="card p-5">
      <p>
        {{ lang.t("taalcafe.noKey") }}
        <RouterLink to="/instellingen" class="font-semibold text-brand-strong underline"><UiLabel variant="inline" k="nav.settings" /></RouterLink>.
      </p>
    </div>

    <TaalcafePicker v-else-if="!talk" :levels="levels" @choose="begin" />

    <section v-else :aria-label="lang.t('taalcafe.title')">
      <p v-if="talk.kind === 'topic'" class="mb-3 text-sm font-semibold text-muted"><UiLabel variant="inline" k="taalcafe.topic" />: <span lang="nl" translate="no">{{ talk.topic.title }}</span></p>
      <!-- A situation: where you are, who you talk to, and the mission. The goals tick off as you reach them. -->
      <div v-else class="mb-4 grid gap-3" lang="nl" translate="no">
        <div class="card p-4">
          <p class="font-bold">{{ talk.situation.emoji }} {{ talk.situation.title }}</p>
          <p class="mt-1">{{ talk.situation.setting }}</p>
          <p class="mt-2 text-sm text-muted">
            <span lang="nl">{{ talk.situation.partner.name }}, {{ talk.situation.partner.role }}</span>
            <span v-if="talk.situation.phone" class="ml-2 rounded-full bg-brand-bg px-2 py-0.5 text-xs font-bold text-brand-strong" :lang="lang.locale">📞 {{ lang.t("taalcafe.phone") }}</span>
          </p>
        </div>
        <section class="rounded-2xl border-2 border-brand/50 bg-brand-bg p-4" data-mission :aria-label="lang.t('taalcafe.mission')">
          <div class="mb-2 flex items-center justify-between gap-2">
            <h2 class="font-extrabold" :lang="lang.locale">🎯 {{ lang.t("taalcafe.mission") }}</h2>
            <span class="text-sm font-bold" :lang="lang.locale" aria-live="polite">{{ lang.t("taalcafe.missionProgress", { n: reached.length, total: talk.situation.goals.length }) }}</span>
          </div>
          <ul class="grid gap-1.5">
            <li v-for="g in talk.situation.goals" :key="g.id" class="flex items-start gap-2" :data-goal="g.id" :data-reached="reached.includes(g.id)">
              <span
                class="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 text-sm font-extrabold transition"
                :class="reached.includes(g.id) ? 'animate-pop border-good bg-good text-white dark:text-black' : 'border-line bg-surface'"
                aria-hidden="true"
                >{{ reached.includes(g.id) ? "✓" : "" }}</span
              >
              <span :class="{ 'text-muted line-through decoration-good decoration-2': reached.includes(g.id) }">{{ g.text }}</span>
              <span class="sr-only" :lang="lang.locale">{{ reached.includes(g.id) ? lang.t("taalcafe.goalReached") : lang.t("taalcafe.goalOpen") }}</span>
            </li>
          </ul>
        </section>
      </div>
      <div ref="chatBox" class="relative" data-chat>
      <ol class="grid gap-3" aria-live="polite" lang="nl" translate="no">
        <li v-for="(m, i) in messages" :key="i" class="flex" :class="m.from === 'learner' ? 'justify-end' : 'justify-start'">
          <div v-if="m.from === 'partner'" class="card max-w-[85%] p-3" data-from="partner">
            <p class="mb-1 flex items-center gap-2 text-sm font-bold text-muted">{{ partnerName }} <SpeakButton :text="m.text" /></p>
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

      <p v-if="anyCorrections" class="mt-3 text-sm text-muted">ⓘ {{ lang.t("taalcafe.tapHint") }}</p>
      <!-- The word mission, right above the box where the learner types: use each word in a message. A used word is struck through and slides away; the next one comes in. -->
      <section v-if="topicLevel && !levelWon" class="mt-4 rounded-2xl border-2 border-brand/50 bg-brand-bg p-4" data-words :aria-label="lang.t('taalcafe.wordsMission')">
        <div class="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 class="font-extrabold">🎯 {{ lang.t("taalcafe.wordsMission") }} · {{ lang.t("taalcafe.level", { n: (topicTalk?.level ?? 0) + 1, total: levelCount }) }}</h2>
          <span class="text-sm font-bold" data-words-progress>{{ lang.t("taalcafe.missionProgress", { n: wordsDone, total: topicLevel.words.length }) }}</span>
        </div>
        <p class="mb-3 text-sm">{{ lang.t("taalcafe.wordsHint") }}</p>
        <ul class="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2 overflow-hidden" lang="nl" translate="no">
          <li v-for="(w, i) in places" :key="i" class="min-h-11">
            <Transition name="word" mode="out-in">
              <span
                v-if="w"
                :key="w.word"
                class="nl-wrap block rounded-xl border-2 border-brand bg-surface px-3 py-2 text-center text-lg font-bold"
                data-word
                >{{ w.word }}</span
              >
            </Transition>
          </li>
        </ul>
        <!-- One dot per word of the level -->
        <div class="mt-3 flex gap-1.5" aria-hidden="true">
          <span v-for="n in topicLevel.words.length" :key="n" class="h-2 flex-1 rounded-full transition-colors" :class="n <= wordsDone ? 'bg-good' : 'bg-line'" />
        </div>
        <p class="sr-only" aria-live="polite">{{ wordNews }}</p>
      </section>
      <p v-if="error" class="mt-4 rounded-2xl bg-bad-bg p-4 text-bad" role="alert">✗ {{ error }}</p>
      <!-- The mission is reached: a small celebration, then another round or another situation -->
      <div v-if="missionDone" class="animate-pop mt-4 rounded-2xl border-2 border-good bg-good-bg p-5 text-center" role="status">
        <p class="text-3xl" aria-hidden="true">🎉</p>
        <p class="text-2xl font-extrabold text-good"><UiLabel variant="heading" k="taalcafe.missionDone" /></p>
        <p class="mt-1">{{ lang.t("taalcafe.missionDoneText") }}</p>
        <div class="mt-4 flex flex-wrap justify-center gap-2">
          <AppButton @click="reset"><UiLabel k="taalcafe.another" /></AppButton>
          <AppButton variant="secondary" @click="again"><UiLabel k="taalcafe.again" /></AppButton>
        </div>
      </div>
      <!-- A level won: go up a level, or stop here -->
      <div v-else-if="levelWon && topicTalk" class="animate-pop mt-4 rounded-2xl border-2 border-good bg-good-bg p-5 text-center" role="status" data-level-won>
        <p class="text-3xl tracking-tight" aria-hidden="true">
          <span v-for="n in levelCount" :key="n" :class="n <= topicTalk.level + 1 ? 'text-amber-500' : 'text-line'">★</span>
        </p>
        <p class="text-2xl font-extrabold text-good">
          {{ hasNextLevel ? lang.t("taalcafe.levelWon", { n: topicTalk.level + 1 }) : lang.t("taalcafe.allLevelsWon") }}
        </p>
        <p class="mt-1">{{ hasNextLevel ? lang.t("taalcafe.levelWonText") : lang.t("taalcafe.allLevelsWonText") }}</p>
        <p v-if="saveError" class="mt-2 text-sm text-bad">{{ lang.t("taalcafe.levelNotSaved") }}</p>
        <div class="mt-4 flex flex-wrap justify-center gap-2">
          <AppButton v-if="hasNextLevel" @click="nextLevel"><UiLabel k="taalcafe.nextLevel" /></AppButton>
          <AppButton v-else @click="again"><UiLabel k="taalcafe.again" /></AppButton>
          <AppButton variant="secondary" @click="reset"><UiLabel k="taalcafe.stop" /></AppButton>
        </div>
      </div>
      <p v-else-if="done" class="card mt-4 p-4 font-semibold">{{ lang.t("taalcafe.done") }}</p>
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
      <!-- Scrolled to after each message: the newest answer, the word mission and the box (or the end card) stay in view -->
      <div ref="end" />
    </section>
  </div>
</template>
