import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "dashboard", component: () => import("./views/DashboardView.vue") },
    { path: "/module/:id", name: "module", component: () => import("./views/ModuleView.vue") },
    { path: "/unit/:id", name: "unit", component: () => import("./views/UnitView.vue") },
    { path: "/instellingen", name: "settings", component: () => import("./views/SettingsView.vue") },
  ],
});
