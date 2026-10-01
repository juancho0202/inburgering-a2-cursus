import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "../api/client";
import type { VocabEntry } from "@shared/types";

export type VocabRow = VocabEntry & { state: "new" | "learning" | "learned" };
export interface VocabTheme {
  theme: string;
  title: string;
  entries: VocabRow[];
}

export const useVocabStore = defineStore("vocab", () => {
  const themes = ref<VocabTheme[]>([]);
  const loaded = ref(false);

  async function load(force = false) {
    if (loaded.value && !force) return;
    themes.value = await api.get<VocabTheme[]>("/vocab");
    loaded.value = true;
  }
  const byId = (id: string) => themes.value.flatMap((t) => t.entries).find((e) => e.id === id);
  return { themes, loaded, load, byId };
});
