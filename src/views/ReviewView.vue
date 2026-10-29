<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute, RouterLink } from "vue-router";
import { api } from "../api/client";
import type { SrsCard, VerbEntry, VocabEntry } from "@shared/types";
import { matchesAny, stripArticle } from "@shared/logic/answers";
import type { Grade } from "@shared/logic/srs";
import AppButton from "../components/ui/AppButton.vue";
import ProgressBar from "../components/ui/ProgressBar.vue";
import SpeakButton from "../components/ui/SpeakButton.vue";
import { shuffled } from "../components/exercises/types";
import FeedbackLanguageToggle from "../components/FeedbackLanguageToggle.vue";
import UiLabel from "../components/ui/UiLabel.vue";
import UiText from "../components/ui/UiText.vue";
import { useLanguageStore } from "../stores/language";
import { useSounds } from "../composables/useSounds";

interface Item {
  card: SrsCard;
  vocab: VocabEntry | null;
  verb: VerbEntry | null;
  distractors: string[];
}

const route = useRoute();
const lang = useLanguageStore();
const sounds = useSounds();
const queue = ref<Item[]>([]);
const total = ref(0);
const reviewed = ref(0);
const loaded = ref(false);
const error = ref<string | null>(null);

const current = computed(() => queue.value[0]);
const answered = ref(false);
const wasCorrect = ref(false);
const typed = ref("");
const aux = ref("");
const picked = ref<string | null>(null);
const options = ref<string[]>([]);

onMounted(async () => {
  try {
    const kind = route.query.kind === "verb" ? "verb" : "all";
    queue.value = await api.get<Item[]>(`/srs/due?kind=${kind}&limit=30`);
    total.value = queue.value.length;
    prepare();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    loaded.value = true;
  }
  window.addEventListener("keydown", onKey, true);
});
onBeforeUnmount(() => window.removeEventListener("keydown", onKey, true));

function prepare() {
  answered.value = false;
  wasCorrect.value = false;
  typed.value = "";
  aux.value = "";
  picked.value = null;
  const c = current.value;
  options.value = c && c.vocab && c.card.cardType === "recognise" ? shuffled([c.vocab.definitionNl, ...c.distractors]) : [];
}

const type = computed(() => current.value?.card.cardType);
const gapExample = computed(() => {
  const v = current.value?.vocab;
  if (!v) return "";
  const bare = stripArticle(v.nl).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const replaced = v.example.replace(new RegExp(bare, "i"), "___");
  return replaced === v.example ? v.example : replaced;
});
/** Recognise cards with too few options fall back to "show answer". */
const selfCheck = computed(() => type.value === "recognise" && options.value.length < 2);

function reveal(correct: boolean) {
  wasCorrect.value = correct;
  answered.value = true;
  // "Toon antwoord" is not an answer, so it gets no right/wrong sound.
  if (!selfCheck.value) (correct ? sounds.correct : sounds.wrong)();
}

function check() {
  const c = current.value;
  if (!c || answered.value) return;
  if (c.card.cardType === "meaning" && c.vocab) reveal(matchesAny(typed.value, [c.vocab.nl, stripArticle(c.vocab.nl)]));
  else if (c.card.cardType === "verb-forms" && c.verb) {
    const auxOk = c.verb.auxiliary === "both" || c.verb.auxiliary === aux.value;
    reveal(matchesAny(typed.value, [c.verb.participle]) && auxOk);
  } else if (c.card.cardType === "recognise" && c.vocab && picked.value !== null) reveal(picked.value === c.vocab.definitionNl);
}
function pickArticle(a: "de" | "het") {
  picked.value = a;
  reveal(a === current.value?.vocab?.article);
}
const canCheck = computed(() =>
  type.value === "meaning" ? typed.value.trim() !== "" : type.value === "verb-forms" ? typed.value.trim() !== "" && aux.value !== "" : type.value === "recognise" ? picked.value !== null : false,
);

const grades: { grade: Grade; label: string; style: "bad" | "secondary" | "good" | "primary" }[] = [
  { grade: "opnieuw", label: "common.again", style: "bad" },
  { grade: "moeilijk", label: "review.hard", style: "secondary" },
  { grade: "goed", label: "review.good", style: "good" },
  { grade: "makkelijk", label: "review.easy", style: "primary" },
];

// Saving a grade takes a moment. The graded card stays on screen until it is saved (taking it off the queue first
// would show the next card with this card's answer state), and a second Enter (key repeat, double tap) in that
// moment is ignored, so it cannot grade the same card twice.
let grading = false;
async function grade(g: Grade) {
  const item = queue.value[0];
  if (grading || !item) return;
  grading = true;
  try {
    await api.post("/srs/review", { cardId: item.card.id, grade: g });
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    grading = false;
  }
  queue.value.shift();
  // "Opnieuw" shows the card again later in this session.
  if (g === "opnieuw") queue.value.push(item);
  else reviewed.value++;
  prepare();
}

function onKey(e: KeyboardEvent) {
  if (!current.value) return;
  if (e.key === "Enter") {
    e.preventDefault();
    if (answered.value) grade(wasCorrect.value ? "goed" : "opnieuw");
    else if (selfCheck.value) reveal(true);
    else check();
  } else if (answered.value && ["1", "2", "3", "4"].includes(e.key) && !(e.target instanceof HTMLInputElement)) {
    grade(grades[Number(e.key) - 1].grade);
  }
}
</script>

<template>
  <p v-if="error" class="mb-4 rounded-2xl bg-bad-bg p-4 text-bad">{{ error }}</p>
  <p v-if="!loaded" class="text-muted">{{ lang.t("common.loading") }}</p>

  <div v-else-if="!current" class="card slide-up mx-auto max-w-xl p-8 text-center">
    <div class="text-6xl" aria-hidden="true">🌟</div>
    <p class="mt-3 text-2xl font-extrabold">{{ lang.feedback("review.allDone") }}</p>
    <p v-if="reviewed" class="mt-1 text-muted">{{ lang.feedback("review.reviewed", { n: reviewed }, reviewed) }}</p>
    <RouterLink to="/"><AppButton size="lg" class="mt-6"><UiLabel k="common.back" /></AppButton></RouterLink>
  </div>

  <div v-else class="mx-auto max-w-2xl">
    <div class="mb-6">
      <div class="mb-2 flex justify-between text-sm font-semibold text-muted"><span><UiLabel variant="inline" k="review.title" /></span><span>{{ reviewed }} / {{ total }}</span></div>
      <ProgressBar :value="total ? reviewed / total : 0" />
    </div>

    <div class="card p-6 sm:p-8" lang="nl">
      <!-- meaning -->
      <template v-if="type === 'meaning' && current.vocab">
        <p class="text-sm font-bold uppercase tracking-wide text-muted"><UiLabel variant="heading" k="review.whichWord" /></p>
        <p class="mt-2 text-2xl font-bold">{{ current.vocab.definitionNl }}</p>
        <p class="mt-2 italic text-muted">{{ gapExample }}</p>
        <!-- Nouns are learnt with their article, and the answer shown afterwards has it, so ask for it out loud. -->
        <p v-if="current.vocab.article" class="mt-4 font-semibold"><UiText k="review.withArticle" md /></p>
        <label class="mt-5 block"><span class="sr-only">{{ lang.t("review.yourAnswer") }}</span>
          <input v-model="typed" :disabled="answered" autocomplete="off" autocapitalize="off" spellcheck="false" class="input text-xl" :placeholder="lang.t('review.typeWord')" autofocus />
        </label>
      </template>

      <!-- recognise -->
      <template v-else-if="type === 'recognise' && current.vocab">
        <p class="text-sm font-bold uppercase tracking-wide text-muted"><UiLabel variant="heading" k="review.meaning" /></p>
        <p class="mt-2 flex items-center gap-3 text-4xl font-extrabold">{{ current.vocab.nl }} <SpeakButton :text="current.vocab.nl" /></p>
        <div v-if="!selfCheck" class="mt-5 grid gap-3">
          <button
            v-for="o in options"
            :key="o"
            type="button"
            :disabled="answered"
            class="rounded-2xl border-2 px-4 py-3 text-left text-lg transition"
            :class="
              answered
                ? o === current.vocab.definitionNl
                  ? 'border-good bg-good-bg'
                  : o === picked
                    ? 'border-bad bg-bad-bg'
                    : 'border-line'
                : o === picked
                  ? 'border-brand bg-brand-bg'
                  : 'border-line hover:border-brand'
            "
            @click="picked = o"
          >
            {{ o }}
          </button>
        </div>
      </template>

      <!-- article -->
      <template v-else-if="type === 'article' && current.vocab">
        <p class="text-sm font-bold uppercase tracking-wide text-muted"><UiLabel variant="heading" k="review.article" /></p>
        <p class="mt-2 text-4xl font-extrabold">{{ stripArticle(current.vocab.nl) }}</p>
        <div class="mt-5 grid grid-cols-2 gap-3">
          <button
            v-for="a in ['de', 'het'] as const"
            :key="a"
            type="button"
            :disabled="answered"
            class="rounded-2xl border-2 px-4 py-4 text-2xl font-bold transition"
            :class="answered ? (a === current.vocab.article ? 'border-good bg-good-bg' : a === picked ? 'border-bad bg-bad-bg' : 'border-line') : 'border-line hover:border-brand hover:bg-brand-bg'"
            @click="pickArticle(a)"
          >
            {{ a }}
          </button>
        </div>
      </template>

      <!-- verb-forms -->
      <template v-else-if="type === 'verb-forms' && current.verb">
        <p class="text-sm font-bold uppercase tracking-wide text-muted"><UiLabel variant="heading" k="review.participle" /></p>
        <p class="mt-2 flex items-center gap-3 text-4xl font-extrabold">{{ current.verb.infinitive }} <SpeakButton :text="current.verb.infinitive" /></p>
        <p class="mt-1 text-muted">{{ current.verb.definitionNl }}</p>
        <div class="mt-5 flex flex-wrap items-center gap-3 text-xl">
          <select v-model="aux" :disabled="answered" aria-label="hebben of zijn" class="input !w-auto"><option value="" disabled>hebben / zijn</option><option value="hebben">hebben</option><option value="zijn">zijn</option></select>
          <input v-model="typed" :disabled="answered" autocomplete="off" autocapitalize="off" spellcheck="false" :aria-label="lang.t('review.participle')" class="input !w-56 text-xl" placeholder="gewerkt" />
        </div>
      </template>

      <!-- feedback + answer -->
      <div v-if="answered" class="slide-up mt-6 rounded-2xl p-4" :class="wasCorrect ? 'bg-good-bg' : 'bg-bad-bg'" role="status" aria-live="polite">
        <div class="flex flex-wrap items-start justify-between gap-2">
          <p class="font-bold" :class="wasCorrect ? 'text-good' : 'text-bad'" :lang="lang.feedbackOwn ? lang.locale : 'nl'">{{ wasCorrect ? "✓" : "✗" }} {{ lang.feedback(wasCorrect ? "feedback.good" : "feedback.wrong") }}</p>
          <FeedbackLanguageToggle />
        </div>
        <template v-if="current.vocab">
          <p class="mt-1 text-xl font-bold">{{ current.vocab.nl }} <SpeakButton :text="current.vocab.nl" class="ml-1 align-middle" /></p>
          <p>{{ current.vocab.definitionNl }}</p>
          <p class="italic text-muted">{{ current.vocab.example }}</p>
        </template>
        <template v-else-if="current.verb">
          <p class="mt-1 text-xl font-bold">{{ current.verb.auxiliary === "zijn" ? "is" : "heeft" }} {{ current.verb.participle }}</p>
          <p class="italic text-muted">{{ current.verb.example }}</p>
        </template>
      </div>
    </div>

    <div class="mt-5 flex flex-wrap justify-end gap-3">
      <template v-if="!answered">
        <AppButton v-if="selfCheck" size="lg" @click="reveal(true)"><UiLabel k="review.show" /></AppButton>
        <AppButton v-else-if="type !== 'article'" size="lg" :disabled="!canCheck" @click="check"><UiLabel k="common.check" /></AppButton>
      </template>
      <template v-else>
        <AppButton v-for="(g, i) in grades" :key="g.grade" :variant="g.style" @click="grade(g.grade)">
          <span class="rounded bg-black/10 px-1.5 text-sm">{{ i + 1 }}</span> <UiLabel :k="g.label" />
        </AppButton>
      </template>
    </div>
  </div>
</template>
