import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "../api/client";

interface SettingsView {
  apiKey: string | null;
  model: string;
  dailyGoalMinutes: number;
  newCardsPerDay: number;
  speechRate: number;
  spellcheckWriting: boolean;
  theme: "light" | "dark" | "system";
}

export const useSettingsStore = defineStore("settings", () => {
  const settings = ref<SettingsView | null>(null);
  const loading = ref(false);
  const testResult = ref<{ ok: boolean; message: string } | null>(null);

  async function load() {
    loading.value = true;
    try {
      settings.value = await api.get<SettingsView>("/settings");
    } finally {
      loading.value = false;
    }
  }

  async function update(patch: Partial<SettingsView>) {
    settings.value = await api.put<SettingsView>("/settings", patch);
  }

  async function testKey() {
    testResult.value = await api.post<{ ok: boolean; message: string }>("/settings/test-key");
  }

  return { settings, loading, testResult, load, update, testKey };
});
