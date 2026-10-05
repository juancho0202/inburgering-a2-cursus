<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { useSettingsStore } from "./stores/settings";
import { applyTheme } from "./composables/theme";

const settings = useSettingsStore();
const route = useRoute();
const mq = window.matchMedia("(prefers-color-scheme: dark)");
const refresh = () => applyTheme(settings.settings?.theme ?? "system");

const menuOpen = ref(false);
const menuButton = ref<HTMLButtonElement | null>(null);
const closeButton = ref<HTMLButtonElement | null>(null);

async function openMenu() {
  menuOpen.value = true;
  await nextTick();
  closeButton.value?.focus();
}
function closeMenu(returnFocus = true) {
  if (!menuOpen.value) return;
  menuOpen.value = false;
  if (returnFocus) nextTick(() => menuButton.value?.focus());
}
const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeMenu();

onMounted(() => {
  settings.load();
  mq.addEventListener("change", refresh);
  window.addEventListener("keydown", onKey);
});
onBeforeUnmount(() => {
  mq.removeEventListener("change", refresh);
  window.removeEventListener("keydown", onKey);
  document.body.style.overflow = "";
});
watch(() => settings.settings?.theme, refresh, { immediate: true });
// Close the menu after choosing a page; keep the page from scrolling behind it.
watch(() => route.fullPath, () => closeMenu(false));
watch(menuOpen, (open) => (document.body.style.overflow = open ? "hidden" : ""));

const links = [
  { to: "/", label: "Leren", icon: "🏠" },
  { to: "/woorden", label: "Woorden", icon: "🔤" },
  { to: "/werkwoorden", label: "Werkwoorden", icon: "🔁" },
  { to: "/examens", label: "Examens", icon: "⏱️" },
  { to: "/samenvatting", label: "Samenvatting", icon: "📝" },
  { to: "/instellingen", label: "Instellingen", icon: "⚙️" },
];
// "/" must only be active on the home page (and not on every page).
const isActive = (to: string) => (to === "/" ? route.path === "/" : route.path === to || route.path.startsWith(to + "/"));
const linkClass = (to: string) => (isActive(to) ? "bg-brand-bg text-brand-strong" : "text-muted hover:bg-surface-2 hover:text-ink");
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <a href="#main" class="sr-only z-50 rounded-xl bg-surface px-4 py-2 font-bold focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Naar de inhoud</a>

    <header v-if="!route.meta.focus" class="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div class="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2.5">
        <RouterLink to="/" class="mr-2 flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <span class="grid h-9 w-9 place-items-center rounded-xl bg-brand text-lg text-white" aria-hidden="true">NL</span>
          <span>Inburgering A2</span>
        </RouterLink>

        <!-- Desktop: links in the top bar -->
        <nav class="hidden items-center gap-1 md:flex" aria-label="Hoofdmenu">
          <RouterLink
            v-for="l in links"
            :key="l.to"
            :to="l.to"
            class="flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-semibold transition"
            :class="linkClass(l.to)"
            :aria-current="isActive(l.to) ? 'page' : undefined"
          >
            <span aria-hidden="true">{{ l.icon }}</span>{{ l.label }}
          </RouterLink>
        </nav>

        <!-- Mobile: hamburger button -->
        <button
          ref="menuButton"
          type="button"
          class="ml-auto grid h-11 w-11 place-items-center rounded-xl border-2 border-line text-ink transition hover:bg-surface-2 md:hidden"
          aria-label="Menu openen"
          aria-controls="mobile-menu"
          :aria-expanded="menuOpen"
          @click="openMenu"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>
      </div>
    </header>

    <!-- Mobile: sidebar panel -->
    <Transition name="drawer">
      <div v-if="menuOpen && !route.meta.focus" class="fixed inset-0 z-50 md:hidden">
        <div class="drawer-overlay absolute inset-0 bg-black/50" @click="closeMenu()" />
        <nav id="mobile-menu" class="drawer-panel absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-line bg-surface p-4 shadow-2xl" aria-label="Hoofdmenu">
          <div class="mb-4 flex items-center justify-between">
            <span class="flex items-center gap-2 text-lg font-extrabold">
              <span class="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white" aria-hidden="true">NL</span>
              Inburgering A2
            </span>
            <button ref="closeButton" type="button" class="grid h-11 w-11 place-items-center rounded-xl text-ink transition hover:bg-surface-2" aria-label="Menu sluiten" @click="closeMenu()">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
          <ul class="grid gap-1">
            <li v-for="l in links" :key="l.to">
              <RouterLink
                :to="l.to"
                class="flex items-center gap-3 rounded-2xl px-4 py-3 text-lg font-bold transition"
                :class="linkClass(l.to)"
                :aria-current="isActive(l.to) ? 'page' : undefined"
              >
                <span class="w-7 text-center text-2xl" aria-hidden="true">{{ l.icon }}</span>{{ l.label }}
              </RouterLink>
            </li>
          </ul>
        </nav>
      </div>
    </Transition>

    <main id="main" tabindex="-1" class="mx-auto w-full flex-1 px-4 py-6 sm:py-8" :class="route.meta.focus ? 'max-w-6xl' : 'max-w-5xl'">
      <RouterView />
    </main>
  </div>
</template>
