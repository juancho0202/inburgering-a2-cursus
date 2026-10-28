<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from "vue";
import { RouterLink } from "vue-router";
import { moduleStyle } from "../lib/moduleStyle";
import ProgressBar from "./ui/ProgressBar.vue";
import UiLabel from "./ui/UiLabel.vue";
import { useLanguageStore } from "../stores/language";
import { useSettingsStore } from "../stores/settings";

interface ModuleSummary {
  id: string;
  title: string;
  total: number;
  completed: number;
}

const props = defineProps<{ modules: ModuleSummary[] }>();
const lang = useLanguageStore();
const emit = defineEmits<{ warm: [id: string] }>();

/** About the long press of the phone's own home screen: long enough not to fire while scrolling, short enough to find. */
const HOLD_MS = 600;
/** A finger that moves further than this while holding is scrolling, not holding. */
const HOLD_SLOP_PX = 10;

const settings = useSettingsStore();
const list = ref<ModuleSummary[]>([...props.modules]);
watch(
  () => props.modules,
  (m) => (list.value = [...m]),
);
const editing = ref(false);
const dragId = ref<string | null>(null);
const saveError = ref<string | null>(null);
const status = ref("");
/** Where "Klaar" sticks in edit mode: just below the app's top bar (which is sticky itself). */
const stickyTop = ref(8);

let hold: { id: string; x: number; y: number; timer: ReturnType<typeof setTimeout> } | null = null;
let orderAtDragStart = "";
let saving: Promise<unknown> = Promise.resolve();

const order = () => list.value.map((m) => m.id).join(",");

function toggleEditing() {
  editing.value = !editing.value;
  status.value = "";
}

watch(editing, (on) => {
  if (on) stickyTop.value = (document.querySelector("header")?.offsetHeight ?? 0) + 8;
});

// ----- holding a card (phone): edit mode, and the same finger can drag the card right away -----
function pressStart(e: PointerEvent, id: string) {
  if (editing.value || e.button !== 0) return;
  cancelHold();
  hold = { id, x: e.clientX, y: e.clientY, timer: setTimeout(holdDone, HOLD_MS) };
  listen();
}

function holdDone() {
  if (!hold) return;
  const { id } = hold;
  cancelHold();
  editing.value = true;
  navigator.vibrate?.(20);
  startDrag(id);
}

function cancelHold() {
  if (hold) clearTimeout(hold.timer);
  hold = null;
  if (!dragId.value) unlisten();
}

/** Android opens the link menu on a long press, sometimes before our timer: take it as the hold instead. */
function onContextMenu(e: Event) {
  if (hold) {
    e.preventDefault();
    holdDone();
  } else if (editing.value) e.preventDefault();
}

function open(e: MouseEvent, navigate: (e: MouseEvent) => unknown) {
  if (editing.value) e.preventDefault();
  else navigate(e);
}

// ----- dragging by the handle (or after a hold) -----
function startDrag(id: string) {
  dragId.value = id;
  orderAtDragStart = order();
  listen();
}

let finger = { x: 0, y: 0 };
let scrollFrame = 0;

function onMove(e: PointerEvent) {
  if (hold && Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > HOLD_SLOP_PX) cancelHold();
  if (!dragId.value) return;
  finger = { x: e.clientX, y: e.clientY };
  placeUnderFinger();
  if (!scrollFrame) scrollFrame = requestAnimationFrame(autoScroll);
}

function placeUnderFinger() {
  const over = document.elementFromPoint?.(finger.x, finger.y)?.closest<HTMLElement>("[data-module-id]") ?? nearestCard();
  const to = over ? list.value.findIndex((m) => m.id === over.dataset.moduleId) : -1;
  if (dragId.value && to >= 0) moveTo(dragId.value, to);
}

/** Between cards, or above or below the list (over the top bar, say): the card closest to the finger. */
function nearestCard() {
  let best: HTMLElement | null = null;
  let bestDistance = Infinity;
  for (const el of Array.from(document.querySelectorAll<HTMLElement>("[data-module-id]"))) {
    const r = el.getBoundingClientRect();
    if (!r.height) continue;
    const d = Math.hypot(Math.max(r.left - finger.x, 0, finger.x - r.right), Math.max(r.top - finger.y, 0, finger.y - r.bottom));
    if (d < bestDistance) [best, bestDistance] = [el, d];
  }
  return best;
}

/** Near the top or bottom edge the page scrolls along, also while the finger rests there, so every place can be reached. */
function autoScroll() {
  scrollFrame = 0;
  if (!dragId.value) return;
  const edge = 80;
  const dy = finger.y < edge ? -12 : finger.y > window.innerHeight - edge ? 12 : 0;
  if (!dy) return;
  window.scrollBy(0, dy);
  placeUnderFinger();
  scrollFrame = requestAnimationFrame(autoScroll);
}

function stopAutoScroll() {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = 0;
}

function onUp() {
  if (hold) return cancelHold();
  if (!dragId.value) return;
  dragId.value = null;
  stopAutoScroll();
  unlisten();
  if (order() !== orderAtDragStart) save();
}

/**
 * While dragging, the finger must move the card, not scroll the page. This listener sits on the cards from the start:
 * the browser decides when a touch begins whether it may block scrolling, so one added after the hold is ignored.
 */
const noScroll = (e: TouchEvent) => {
  if (dragId.value) e.preventDefault();
};

let listening = false;
function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
}
function unlisten() {
  listening = false;
  window.removeEventListener("pointermove", onMove);
  window.removeEventListener("pointerup", onUp);
  window.removeEventListener("pointercancel", onUp);
}

function moveTo(id: string, to: number) {
  const from = list.value.findIndex((m) => m.id === id);
  if (from < 0 || to === from || to < 0 || to >= list.value.length) return false;
  const next = [...list.value];
  next.splice(to, 0, ...next.splice(from, 1));
  list.value = next;
  status.value = lang.t("modules.moved", { title: next[to].title, n: to + 1, total: next.length });
  return true;
}

// ----- keyboard: arrow keys on the handle -----
async function onHandleKey(e: KeyboardEvent, id: string) {
  const step = { ArrowUp: -1, ArrowLeft: -1, ArrowDown: 1, ArrowRight: 1 }[e.key];
  if (!step) return;
  e.preventDefault();
  if (!moveTo(id, list.value.findIndex((m) => m.id === id) + step)) return;
  save();
  // A browser drops the focus when the focused card's element is moved in the page; put it back on the handle so the
  // next key press moves the card again. (jsdom keeps the focus, so no test can catch this line.)
  await nextTick();
  document.querySelector<HTMLElement>(`[data-module-id="${id}"] [data-handle]`)?.focus();
}

function save() {
  const moduleOrder = list.value.map((m) => m.id);
  saveError.value = null;
  // One after the other, so a quick second move can never be overwritten by the first one.
  saving = saving
    .then(() => settings.update({ moduleOrder }))
    .catch(() => (saveError.value = lang.t("modules.saveError")));
}

onBeforeUnmount(() => {
  if (hold) clearTimeout(hold.timer);
  hold = null;
  dragId.value = null;
  stopAutoScroll();
  unlisten();
});
</script>

<template>
  <!-- In edit mode "Klaar" sticks below the top bar. CSS sticky (no scroll handler) so it never lags or jumps; the button
       spans every row of this section, and the rest of the page comes in through the slot, so it stays up to the end. -->
  <section class="grid grid-cols-[minmax(0,1fr)_auto] grid-rows-[auto_1fr] gap-3">
    <h2 class="glass col-start-1 row-start-1 justify-self-start rounded-2xl px-4 py-1 text-2xl font-bold"><UiLabel k="modules.title" /></h2>
    <button
      type="button"
      class="glass col-start-2 row-span-2 row-start-1 inline-flex items-center gap-2 self-start rounded-2xl px-4 py-2 font-bold transition hover:text-brand-strong"
      :class="editing && 'sticky z-20 shadow-lg'"
      :style="editing ? { top: `${stickyTop}px` } : undefined"
      :aria-pressed="editing"
      @click="toggleEditing"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path v-if="editing" d="M5 12.5l4.5 4.5L19 7" />
        <path v-else d="M7 20V4M3 8l4-4 4 4M17 4v16M13 16l4 4 4-4" />
      </svg>
      <UiLabel :k="editing ? 'modules.done' : 'modules.sort'" />
    </button>
    <div class="col-span-2 col-start-1 row-start-2 min-w-0">
      <p v-if="editing" id="module-order-hint" class="glass mb-3 rounded-2xl px-4 py-2 text-sm">
        {{ lang.t("modules.dragHint1") }} <span aria-hidden="true">⠿</span> {{ lang.t("modules.dragHint2") }}
      </p>
      <p v-if="saveError" role="alert" class="mb-3 rounded-2xl bg-bad-bg px-4 py-2 font-semibold text-bad">{{ saveError }}</p>
      <p class="sr-only" role="status">{{ status }}</p>
      <!-- No scroll anchoring: the browser would scroll the page each time the dragged card moves, away from the finger. -->
      <div class="grid gap-4 [overflow-anchor:none] sm:grid-cols-2">
        <!-- Always the same <a>: swapping the element under a holding finger would end the touch and its drag. -->
        <RouterLink v-for="m in list" :key="m.id" v-slot="{ href, navigate }" :to="`/module/${m.id}`" custom>
          <a
            :href="editing ? undefined : href"
            :data-module-id="m.id"
            class="card group block select-none p-5 transition [-webkit-touch-callout:none]"
            :class="editing ? (dragId === m.id ? 'z-10 scale-[1.03] shadow-xl ring-4 ring-brand' : '') : 'hover:-translate-y-0.5 hover:shadow-lg'"
            @click="open($event, navigate)"
            @contextmenu="onContextMenu"
            @pointerdown="pressStart($event, m.id)"
            @pointerenter="emit('warm', m.id)"
            @focus="emit('warm', m.id)"
            @touchstart.passive="emit('warm', m.id)"
            @touchmove="noScroll"
          >
            <div class="flex items-center gap-4">
              <span class="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-3xl" :class="moduleStyle(m.id).tile" aria-hidden="true">{{ moduleStyle(m.id).emoji }}</span>
              <div class="min-w-0 flex-1">
                <h3 class="text-xl font-bold" :class="!editing && 'group-hover:text-brand-strong'" lang="nl" translate="no">{{ m.title }}</h3>
                <p v-if="m.total" class="text-sm text-muted">{{ lang.t("modules.progress", { done: m.completed, total: m.total }) }}</p>
                <p v-else class="text-sm text-muted">{{ lang.t("modules.examTime") }}</p>
              </div>
              <button
                v-if="editing"
                type="button"
                data-handle
                class="grid h-12 w-12 shrink-0 cursor-grab touch-none place-items-center rounded-2xl bg-surface-2 text-2xl text-muted active:cursor-grabbing"
                :aria-label="lang.t('modules.move', { title: m.title })"
                aria-describedby="module-order-hint"
                @pointerdown.stop.prevent="startDrag(m.id)"
                @keydown="onHandleKey($event, m.id)"
              >
                ⠿
              </button>
            </div>
            <div v-if="m.total" class="mt-4"><ProgressBar :value="m.completed / m.total" :label="lang.t('modules.progressOf', { title: m.title })" /></div>
          </a>
        </RouterLink>
      </div>
      <div v-if="$slots.default" class="mt-6 grid gap-6"><slot /></div>
    </div>
  </section>
</template>
