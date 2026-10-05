import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { api } from "../api/client";

interface SettingsView {
  apiKey: string | null;
  model: string;
  dailyGoalMinutes: number;
  newCardsPerDay: number;
  speechRate: number;
  spellcheckWriting: boolean;
  theme: "light" | "dark" | "system";
  usage: { month: string; requests: number; inputTokens: number; outputTokens: number };
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

  async function saveKey(apiKey: string) {
    settings.value = await api.post<SettingsView>("/settings/api-key", { apiKey });
  }

  async function removeKey() {
    settings.value = await api.post<SettingsView>("/settings/api-key/remove");
    testResult.value = null;
  }

  async function testKey() {
    testResult.value = await api.post<{ ok: boolean; message: string }>("/settings/test-key");
  }

  /** True when an API key is set, so Claude features can be offered. */
  const hasKey = computed(() => settings.value?.apiKey != null);

  return { settings, loading, testResult, hasKey, load, update, saveKey, removeKey, testKey };
});
