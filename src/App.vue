<script setup lang="ts">
import { onBeforeUnmount, onMounted, watch } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";
import { useSettingsStore } from "./stores/settings";
import { applyTheme } from "./composables/theme";

const settings = useSettingsStore();
const route = useRoute();
const mq = window.matchMedia("(prefers-color-scheme: dark)");
const refresh = () => applyTheme(settings.settings?.theme ?? "system");

onMounted(() => {
  settings.load();
  mq.addEventListener("change", refresh);
});
onBeforeUnmount(() => mq.removeEventListener("change", refresh));
watch(() => settings.settings?.theme, refresh, { immediate: true });

const links = [
  { to: "/", label: "Leren", icon: "🏠" },
  { to: "/woorden", label: "Woorden", icon: "🔤" },
  { to: "/werkwoorden", label: "Werkwoorden", icon: "🔁" },
  { to: "/examens", label: "Examens", icon: "⏱️" },
  { to: "/samenvatting", label: "Samenvatting", icon: "📝" },
  { to: "/instellingen", label: "Instellingen", icon: "⚙️" },
];
</script>

<template>
  <div class="flex min-h-screen flex-col">
    <a href="#main" class="sr-only z-50 rounded-xl bg-surface px-4 py-2 font-bold focus:not-sr-only focus:fixed focus:left-4 focus:top-4">Naar de inhoud</a>
    <header v-if="!route.meta.focus" class="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <nav class="mx-auto flex max-w-5xl items-center gap-2 px-4 py-2.5" aria-label="Hoofdmenu">
        <RouterLink to="/" class="mr-2 flex items-center gap-2 text-xl font-extrabold tracking-tight">
          <span class="grid h-9 w-9 place-items-center rounded-xl bg-brand text-lg text-white" aria-hidden="true">NL</span>
          <span class="hidden sm:inline">Inburgering A2</span>
        </RouterLink>
        <RouterLink
          v-for="l in links"
          :key="l.to"
          :to="l.to"
          class="flex items-center gap-1.5 rounded-xl px-3 py-1.5 font-semibold text-muted transition hover:bg-surface-2 hover:text-ink"
          active-class="!bg-brand-bg !text-brand-strong"
          exact-active-class="!bg-brand-bg !text-brand-strong"
        >
          <span aria-hidden="true">{{ l.icon }}</span>
          <span :class="l.to === '/' ? '' : 'hidden md:inline'">{{ l.label }}</span>
        </RouterLink>
      </nav>
    </header>
    <main id="main" tabindex="-1" class="mx-auto w-full flex-1 px-4 py-6 sm:py-8" :class="route.meta.focus ? 'max-w-6xl' : 'max-w-5xl'">
      <RouterView />
    </main>
  </div>
</template>
