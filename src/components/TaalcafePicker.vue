<script setup lang="ts">
import { nextTick, ref } from "vue";
import { TAALCAFE_TOPICS, type TaalcafeTopic } from "@shared/logic/taalcafe";
import { SITUATION_GROUPS, TAALCAFE_SITUATIONS, type TaalcafeSituation } from "@shared/logic/taalcafeSituations";
import { topicLevels } from "@shared/logic/taalcafeWords";
import { useLanguageStore } from "../stores/language";
import UiLabel from "./ui/UiLabel.vue";

/** A topic is played at one of its word levels (0 = the first). */
export type TaalcafeTalk = { kind: "topic"; topic: TaalcafeTopic; level: number } | { kind: "situation"; situation: TaalcafeSituation };

/** Word levels won per topic id. */
const props = defineProps<{ levels: Record<string, number> }>();
const emit = defineEmits<{ choose: [talk: TaalcafeTalk] }>();
const lang = useLanguageStore();

// One tab per kind of practice. The last one opened is remembered on this device (a convenience: it may be lost).
const TABS = [
  { id: "onderwerpen", k: "taalcafe.tabTopics" },
  { id: "situaties", k: "taalcafe.tabSituations" },
] as const;
type TabId = (typeof TABS)[number]["id"];
const STORE_KEY = "taalcafeTab";
function remembered(): TabId {
  try {
    const v = localStorage.getItem(STORE_KEY);
    return TABS.some((t) => t.id === v) ? (v as TabId) : "onderwerpen";
  } catch {
    return "onderwerpen";
  }
}
const tab = ref<TabId>(remembered());
const tabEls = ref<HTMLElement[]>([]);

function select(id: TabId) {
  tab.value = id;
  try {
    localStorage.setItem(STORE_KEY, id);
  } catch {
    // private mode or blocked storage: the tab is simply not remembered
  }
}

// The ARIA tabs pattern: arrow keys move between tabs (and select them), Home and End jump to the first and last.
async function onTabKey(e: KeyboardEvent, i: number) {
  const last = TABS.length - 1;
  const to = e.key === "ArrowRight" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : -1;
  if (to < 0) return;
  e.preventDefault();
  select(TABS[to].id);
  await nextTick();
  tabEls.value[to]?.focus();
}

const situationsIn = (group: string) => TAALCAFE_SITUATIONS.filter((s) => s.group === group);

const won = (t: TaalcafeTopic) => Math.min(props.levels[t.id] ?? 0, topicLevels(t.id).length);
// A topic goes on at the first level not won yet; with every level won, the last one is played again.
const startLevel = (t: TaalcafeTopic) => Math.min(won(t), topicLevels(t.id).length - 1);
</script>

<template>
  <div>
    <div role="tablist" :aria-label="lang.t('taalcafe.tabsLabel')" class="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1">
      <button
        v-for="(t, i) in TABS"
        :id="`taalcafe-tab-${t.id}`"
        :key="t.id"
        :ref="(el) => (tabEls[i] = el as HTMLElement)"
        type="button"
        role="tab"
        :aria-selected="tab === t.id"
        :aria-controls="`taalcafe-panel-${t.id}`"
        :tabindex="tab === t.id ? 0 : -1"
        class="rounded-xl px-3 py-2.5 font-bold transition"
        :class="tab === t.id ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink'"
        @click="select(t.id)"
        @keydown="onTabKey($event, i)"
      >
        <UiLabel :k="t.k" />
      </button>
    </div>

    <section v-if="tab === 'onderwerpen'" id="taalcafe-panel-onderwerpen" role="tabpanel" aria-labelledby="taalcafe-tab-onderwerpen">
      <p class="mb-4 text-muted">{{ lang.t("taalcafe.topicsIntro") }}</p>
      <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2" lang="nl" translate="no">
        <li v-for="t in TAALCAFE_TOPICS" :key="t.id">
          <button
            type="button"
            class="card flex w-full items-center gap-3 p-4 text-left font-bold transition hover:-translate-y-0.5 hover:shadow-lg"
            :data-topic="t.id"
            @click="emit('choose', { kind: 'topic', topic: t, level: startLevel(t) })"
          >
            <span class="text-2xl" aria-hidden="true">{{ t.emoji }}</span>
            <span class="min-w-0 flex-1">{{ t.title }}</span>
            <!-- One star per level won -->
            <span class="shrink-0 text-lg tracking-tight" aria-hidden="true" data-stars
              ><span v-for="n in topicLevels(t.id).length" :key="n" :class="n <= won(t) ? 'text-amber-500' : 'text-line'">★</span></span
            >
            <span class="sr-only" :lang="lang.locale">{{ lang.t("taalcafe.levelsWon", { n: won(t), total: topicLevels(t.id).length }) }}</span>
          </button>
        </li>
      </ul>
    </section>

    <section v-else id="taalcafe-panel-situaties" role="tabpanel" aria-labelledby="taalcafe-tab-situaties">
      <p class="mb-4 text-muted">{{ lang.t("taalcafe.situationsIntro") }}</p>
      <div class="grid gap-6">
        <div v-for="g in SITUATION_GROUPS" :key="g.id">
          <h3 class="mb-2 text-lg font-bold" lang="nl" translate="no">{{ g.title }}</h3>
          <ul class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <li v-for="s in situationsIn(g.id)" :key="s.id">
              <button
                type="button"
                class="card flex h-full w-full items-start gap-3 p-4 text-left transition hover:-translate-y-0.5 hover:shadow-lg"
                :data-situation="s.id"
                @click="emit('choose', { kind: 'situation', situation: s })"
              >
                <span class="text-2xl" aria-hidden="true">{{ s.emoji }}</span>
                <span class="min-w-0 flex-1">
                  <span class="nl-wrap block font-bold" lang="nl" translate="no">{{ s.title }}</span>
                  <span class="nl-wrap block text-sm text-muted" lang="nl" translate="no">{{ s.partner.role }}</span>
                  <span v-if="s.phone" class="mt-1 inline-block rounded-full bg-brand-bg px-2 py-0.5 text-xs font-bold text-brand-strong">📞 {{ lang.t("taalcafe.phone") }}</span>
                </span>
              </button>
            </li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</template>
