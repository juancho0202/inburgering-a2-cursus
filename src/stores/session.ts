import { defineStore } from "pinia";
import { ref } from "vue";

/** Opens the "Klaar voor vandaag" dialog from anywhere (top bar, menu, unit end screen, dashboard). */
export const useSessionStore = defineStore("session", () => {
  const finishOpen = ref(false);
  const openFinish = () => (finishOpen.value = true);
  const closeFinish = () => (finishOpen.value = false);
  return { finishOpen, openFinish, closeFinish };
});
