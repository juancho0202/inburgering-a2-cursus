import { defineStore } from "pinia";
import { ref } from "vue";

/** Words waiting to be reviewed (due + new), as the dashboard last loaded them; the phone top bar shows it. */
export const useReviewStore = defineStore("review", () => {
  const count = ref(0);
  return { count };
});
