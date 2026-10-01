import { defineStore } from "pinia";
import { ref } from "vue";
import { api } from "../api/client";
import type { VerbEntry } from "@shared/types";

export type VerbRow = VerbEntry & { state: "new" | "learning" | "learned" };

export const useVerbsStore = defineStore("verbs", () => {
  const verbs = ref<VerbRow[]>([]);
  let loading: Promise<void> | null = null;

  function load() {
    loading ??= api.get<VerbRow[]>("/verbs").then((v) => {
      verbs.value = v;
    });
    return loading;
  }
  const byId = (id: string) => verbs.value.find((v) => v.id === id);
  return { verbs, load, byId };
});
