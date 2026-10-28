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
import { takeLanguageParam } from "./i18n";

// Before the router starts: the language landing pages link to /?lang=xx (see takeLanguageParam).
takeLanguageParam();

const app = createApp(App);
app.use(createPinia());
app.use(router);
primeBackground();
app.mount("#app");
// Start loading the course in the background; the in-browser API (step 3) will use it.
void loadCourseContent();
// Ask the browser to keep the learner's progress safe from automatic clean-up (installed apps usually get this).
void requestPersistentStorage();
// Offer a new version as soon as one is out (see UpdateBanner).
watchForUpdates();
