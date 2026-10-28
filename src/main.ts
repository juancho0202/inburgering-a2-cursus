import "@shared/zodConfig";
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router";
import "./styles/main.css";
import { loadCourseContent } from "./content";
import { requestPersistentStorage } from "./lib/storage";
import { primeBackground } from "./lib/backgrounds";
import { watchForUpdates } from "./lib/appUpdate";
import { startApp } from "./lib/landing";
import { api } from "./api/client";
import { takeLanguageParam } from "./i18n";

// Before the router starts: the language landing pages link to /?lang=xx (see takeLanguageParam).
// public/boot.js has already seen the query, so these visits skip the landing page.
takeLanguageParam();

const app = createApp(App);
app.use(createPinia());
primeBackground();
// First-time visitors to "/" see the landing page in index.html; the app starts from its start link.
// The router is only added on mount: its first navigation would otherwise move the landing page to /welkom.
void startApp(
  () => app.use(router).mount("#app"),
  async () => (await api.get<{ seen: boolean }>("/welcome")).seen,
);
// Start loading the course in the background; the in-browser API (step 3) will use it.
void loadCourseContent();
// Ask the browser to keep the learner's progress safe from automatic clean-up (installed apps usually get this).
void requestPersistentStorage();
// Offer a new version as soon as one is out (see UpdateBanner).
watchForUpdates();
