import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import { router } from "./router";
import "./styles/main.css";
import { loadCourseContent } from "./content";

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount("#app");
// Start loading the course in the background; the in-browser API (step 3) will use it.
void loadCourseContent();
