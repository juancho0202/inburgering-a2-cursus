import { createRouter, createWebHistory } from "vue-router";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "dashboard", component: () => import("./views/DashboardView.vue") },
    { path: "/module/exams", redirect: "/examens" },
    { path: "/module/:id", name: "module", component: () => import("./views/ModuleView.vue") },
    { path: "/unit/:id", name: "unit", component: () => import("./views/UnitView.vue") },
    { path: "/oefenen", name: "practice", component: () => import("./views/PracticeView.vue") },
    { path: "/woorden", name: "vocab", component: () => import("./views/VocabView.vue") },
    { path: "/woorden/herhalen", name: "review", component: () => import("./views/ReviewView.vue") },
    { path: "/werkwoorden", name: "verbs", component: () => import("./views/VerbsView.vue") },
    { path: "/schrijven/geschiedenis", name: "writing-history", component: () => import("./views/WritingHistoryView.vue") },
    { path: "/samenvatting", name: "samenvatting", component: () => import("./views/SamenvattingView.vue") },
    { path: "/examens", name: "exams", component: () => import("./views/ExamsView.vue") },
    { path: "/examen/:id", name: "exam", component: () => import("./views/ExamView.vue"), meta: { focus: true } },
    { path: "/examen/:id/resultaat/:rid", name: "exam-result", component: () => import("./views/ExamResultView.vue") },
    { path: "/instellingen", name: "settings", component: () => import("./views/SettingsView.vue") },
  ],
  scrollBehavior: () => ({ top: 0 }),
});
