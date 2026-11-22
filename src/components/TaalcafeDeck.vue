<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from "vue";
import { rightFromStart, type DeckCard } from "@shared/logic/taalcafeDeck";
import { shuffled } from "./exercises/types";
import { useLanguageStore } from "../stores/language";
import AppButton from "./ui/AppButton.vue";
import UiLabel from "./ui/UiLabel.vue";

/**
 * The last step of a taalcafé word level: a deck of cards, one per sentence that got a correction. Put the words in the
 * right order (the corrected sentence); when it is right, the card slides down and the next one comes up.
 * ✕ or Escape closes the deck without finishing it; the level is only finished after the last card.
 */
const props = defineProps<{ cards: DeckCard[] }>();
const emit = defineEmits<{ done: []; close: [] }>();
const lang = useLanguageStore();

interface Tile {
  id: number;
  text: string;
}
const index = ref(0);
const card = computed(() => props.cards[index.value]);
const pool = ref<Tile[]>([]);
const placed = ref<Tile[]>([]);
const state = ref<"open" | "wrong" | "right">("open");
const dialog = ref<HTMLElement | null>(null);
const nextButton = ref<{ $el: HTMLElement } | null>(null);
const returnTo = document.activeElement as HTMLElement | null;

function deal() {
  const all = card.value.tokens.map((text, id) => ({ id, text }));
  let p = shuffled(all);
  // Never dealt in the right order already (unless every order is the same, like "ja ja").
  for (let n = 0; n < 10 && p.every((t, i) => t.text === card.value.tokens[i]); n++) p = shuffled(all);
  pool.value = p;
  placed.value = [];
  state.value = "open";
}
deal();
onMounted(() => dialog.value?.focus());

// Once right, the placed words are disabled and the pool is empty: nothing to guard here.
function place(t: Tile) {
  pool.value = pool.value.filter((x) => x.id !== t.id);
  placed.value = [...placed.value, t];
  state.value = "open";
}
function unplace(t: Tile) {
  placed.value = placed.value.filter((x) => x.id !== t.id);
  pool.value = [...pool.value, t];
  state.value = "open";
}

// Only reachable with every word placed: the button is disabled before that, and gone once right.
async function check() {
  const keep = rightFromStart(
    placed.value.map((t) => t.text),
    card.value.tokens,
  );
  if (keep === card.value.tokens.length) {
    state.value = "right";
    await nextTick();
    nextButton.value?.$el.focus();
    return;
  }
  // The right start stays; the rest goes back to the words, to try again.
  pool.value = [...pool.value, ...placed.value.slice(keep)];
  placed.value = placed.value.slice(0, keep);
  state.value = "wrong";
}

const last = computed(() => index.value === props.cards.length - 1);
async function next() {
  if (state.value !== "right") return;
  if (last.value) {
    emit("done");
    return;
  }
  index.value++;
  deal();
  await nextTick();
  dialog.value?.focus();
}

function close() {
  emit("close");
  returnTo?.focus?.();
}

/** The learner's sentence with the corrected parts marked, as pieces. */
const marked = computed(() => {
  const out: { text: string; wrong: boolean }[] = [];
  let rest = card.value.original;
  for (const w of card.value.wrong) {
    const at = rest.indexOf(w);
    if (at < 0) continue;
    if (at > 0) out.push({ text: rest.slice(0, at), wrong: false });
    out.push({ text: w, wrong: true });
    rest = rest.slice(at + w.length);
  }
  if (rest) out.push({ text: rest, wrong: false });
  return out;
});
</script>

<template>
  <div class="fixed inset-0 z-[60] grid items-start justify-items-center overflow-y-auto overscroll-contain bg-black/60 p-3 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="deck-title" @keydown.esc="close">
    <!-- One solid panel: the page must not show through while a card slides away -->
    <div ref="dialog" tabindex="-1" class="relative w-full max-w-lg rounded-3xl bg-bg p-4 shadow-2xl outline-none sm:p-5" data-deck>
      <div class="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 id="deck-title" class="text-2xl font-extrabold"><span aria-hidden="true">🧩 </span><UiLabel variant="heading" k="taalcafe.deckTitle" /></h2>
          <p class="mt-1 text-muted">{{ lang.t("taalcafe.deckIntro") }}</p>
        </div>
        <button
          type="button"
          class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-xl text-muted hover:bg-surface-2 hover:text-ink"
          :aria-label="lang.t('common.close')"
          @click="close"
        >
          ✕
        </button>
      </div>

      <div class="relative">
        <!-- The cards still to come, as a stack behind the open one -->
        <div v-for="n in Math.min(cards.length - index - 1, 2)" :key="n" class="card absolute inset-x-0 top-0 h-full" :style="{ transform: `translateY(${n * 8}px) scale(${1 - n * 0.04})`, zIndex: -n }" aria-hidden="true" />
        <Transition name="deck" mode="out-in">
          <section :key="index" class="card relative p-5" :aria-label="lang.t('taalcafe.deckCard', { n: index + 1, total: cards.length })" data-card>
            <p class="text-sm font-bold text-muted">{{ lang.t("taalcafe.deckCard", { n: index + 1, total: cards.length }) }}</p>
            <p class="mt-2 text-sm text-muted">{{ lang.t("taalcafe.deckYouWrote") }}</p>
            <p class="nl-wrap text-lg" lang="nl" translate="no" data-original>
              <template v-for="(p, i) in marked" :key="i"
                ><del v-if="p.wrong" class="rounded bg-bad-bg px-0.5 text-bad">{{ p.text }}</del><span v-else>{{ p.text }}</span></template
              >
            </p>

            <div
              class="mt-4 flex min-h-16 flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed p-3"
              :class="state === 'right' ? 'border-good bg-good-bg' : state === 'wrong' ? 'border-bad bg-bad-bg' : 'border-line bg-surface'"
              :aria-label="lang.t('taalcafe.deckYourSentence')"
              lang="nl"
              translate="no"
              data-answer
            >
              <button
                v-for="t in placed"
                :key="t.id"
                type="button"
                :disabled="state === 'right'"
                class="rounded-xl border-2 border-brand bg-brand-bg px-3 py-1.5 text-lg font-semibold"
                @click="unplace(t)"
              >
                {{ t.text }}
              </button>
              <span v-if="!placed.length" class="text-muted" :lang="lang.locale">{{ lang.t("taalcafe.deckHint") }}</span>
            </div>
            <div class="mt-3 flex flex-wrap gap-2" :aria-label="lang.t('taalcafe.deckWords')" lang="nl" translate="no" data-pool>
              <button
                v-for="t in pool"
                :key="t.id"
                type="button"
                class="rounded-xl border-2 border-line bg-surface px-3 py-1.5 text-lg font-semibold shadow-[0_2px_0_var(--line)] transition hover:border-brand active:translate-y-px"
                @click="place(t)"
              >
                {{ t.text }}
              </button>
            </div>

            <div aria-live="polite">
              <p v-if="state === 'wrong'" class="mt-3 font-semibold text-bad">✗ {{ lang.feedback("taalcafe.deckWrong") }}</p>
              <div v-else-if="state === 'right'" class="mt-3">
                <p class="font-semibold text-good">✓ {{ lang.feedback("taalcafe.deckRight") }}</p>
                <ul class="mt-1 grid gap-1 text-sm" lang="nl" translate="no">
                  <li v-for="(e, i) in card.explanations" :key="i">{{ e }}</li>
                </ul>
              </div>
            </div>

            <div class="mt-4 flex justify-end">
              <AppButton v-if="state === 'right'" ref="nextButton" @click="next"><UiLabel :k="last ? 'taalcafe.deckDone' : 'taalcafe.deckNext'" /></AppButton>
              <AppButton v-else :disabled="pool.length > 0" @click="check"><UiLabel k="taalcafe.deckCheck" /></AppButton>
            </div>
          </section>
        </Transition>
      </div>
    </div>
  </div>
</template>
