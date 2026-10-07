// @vitest-environment jsdom
// The start page and the module page: where "continue" leads and what is recommended next.
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardView from "../../../src/views/DashboardView.vue";
import ModuleView from "../../../src/views/ModuleView.vue";
import { clickButton, fakeApi, mountApp } from "../../helpers/component";
import { useSessionStore } from "../../../src/stores/session";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

const course = {
  id: "c", title: "Cursus",
  modules: [
    { id: "exams", title: "Proefexamens", description: "", icon: "", units: [] },
    { id: "basis", title: "Basis", description: "Eerste stappen", icon: "", units: [
      { id: "basis-a", title: "Les A", estimatedMinutes: 10, stepCount: 8 },
      { id: "basis-b", title: "Les B", estimatedMinutes: 12, stepCount: 9 },
      { id: "basis-c", title: "Les C", estimatedMinutes: 15, stepCount: 11 },
    ] },
  ],
};
const dashboard = (extra: Record<string, unknown> = {}) => ({
  lastLocation: null, dailyGoalMinutes: 20, minutesToday: 5, streak: { current: 1, best: 4 }, dueCount: 3, newCount: 2,
  modules: [{ id: "basis", title: "Basis", total: 3, completed: 1 }, { id: "exams", title: "Proefexamens", total: 0, completed: 0 }],
  hardCount: 0, weakTags: [], backupReminder: { show: false, daysAgo: null, unsavedAnswers: 0 }, nextExam: null, ...extra,
});

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET", "/course", course);
});

describe("DashboardView", () => {
  const open = (d: unknown) => {
    fakeApi.on("GET", "/dashboard", d);
    return mountApp(DashboardView, { routePath: "/", url: "/" });
  };

  it("a new learner is sent to the very first lesson (skipping modules without lessons)", async () => {
    const { wrapper } = await open(dashboard());
    expect(wrapper.find("a[href='/unit/basis-a']").text()).toContain("Begin met leren");
    expect(wrapper.text()).toContain("Klaar om te leren?");
  });

  it("someone who was in the middle of a lesson is sent back to that lesson", async () => {
    const { wrapper } = await open(dashboard({ lastLocation: { unitId: "basis-b", unitTitle: "Les B", stepIndex: 3, stepCount: 9 } }));
    expect(wrapper.find("a[href='/unit/basis-b']").text()).toContain("Verder waar ik was");
    expect(wrapper.text()).toContain("Je was bezig met: Les B.");
    expect(wrapper.find("a[href='/unit/basis-a']").exists()).toBe(false);
  });

  it("the review button counts due and new cards together", async () => {
    const { wrapper } = await open(dashboard());
    expect(wrapper.find("a[href='/woorden/herhalen']").text()).toContain("(5)");
  });

  it("modules show their progress; the exam module has no lesson count", async () => {
    const { wrapper } = await open(dashboard());
    expect(wrapper.find("a[href='/module/basis']").text()).toContain("1 van 3 lessen klaar");
    expect(wrapper.find("a[href='/module/exams']").text()).toContain("Oefen onder examentijd");
  });

  it("one day is 'dag', several are 'dagen'", async () => {
    const one = await open(dashboard({ streak: { current: 1, best: 1 } }));
    expect(one.wrapper.text()).toMatch(/1\s*dag(?!en)/);
    const many = await open(dashboard({ streak: { current: 6, best: 9 } }));
    expect(many.wrapper.text()).toMatch(/6\s*dagen/);
  });

  it("the reminder to save progress only appears when it is due, and opens the finish dialog", async () => {
    const none = await open(dashboard());
    expect(none.wrapper.text()).not.toContain("Bewaar je voortgang");
    const { wrapper, pinia } = await open(dashboard({ backupReminder: { show: true, daysAgo: 9, unsavedAnswers: 40 } }));
    expect(wrapper.text()).toContain("Laatst bewaard: 9 dagen geleden.");
    await clickButton(wrapper, "Bewaar nu");
    expect(useSessionStore(pinia).finishOpen).toBe(true);
    const never = await open(dashboard({ backupReminder: { show: true, daysAgo: null, unsavedAnswers: 3 } }));
    expect(never.wrapper.text()).toContain("Je hebt je voortgang nog niet bewaard.");
  });

  it("weak topics link to practice; the Claude button is left out for writing mistakes (there is nothing to generate)", async () => {
    const { wrapper } = await open(dashboard({
      weakTags: [{ tag: "grammar:de-het", accuracy: 0.4, seen: 10 }, { tag: "writing:werkwoordsvorm", accuracy: 0.2, seen: 5 }],
      hardCount: 2,
    }));
    expect(wrapper.text()).toContain("grammar · de-het");
    expect(wrapper.text()).toContain("40% goed (10 antwoorden)");
    expect(wrapper.text()).toContain("Schrijffout: werkwoordsvorm");
    const practice = wrapper.findAll("a").map((a) => decodeURIComponent(a.attributes("href") ?? "")).filter((h) => h.startsWith("/oefenen"));
    expect(practice).toEqual([
      "/oefenen?tag=grammar:de-het",
      "/oefenen?gen=tag&tag=grammar:de-het",
      "/oefenen?tag=writing:werkwoordsvorm", // no "Meer met Claude" for this one
      "/oefenen?mode=hard",
    ]);
    expect(wrapper.text()).toContain("2 moeilijke vragen");
  });

  it("without weak points a friendly note is shown", async () => {
    const { wrapper } = await open(dashboard());
    expect(wrapper.text()).toContain("Nog geen zwakke punten.");
  });

  it("a load error is shown", async () => {
    fakeApi.fail("GET", "/dashboard", "Database niet beschikbaar.");
    const { wrapper } = await mountApp(DashboardView, { routePath: "/", url: "/" });
    expect(wrapper.text()).toContain("Database niet beschikbaar.");
  });
});

describe("ModuleView", () => {
  const open = (progressUnits: Record<string, unknown>, id = "basis") => {
    fakeApi.on("GET", "/progress", { units: progressUnits, items: {} });
    return mountApp(ModuleView, { routePath: "/module/:id", url: `/module/${id}` });
  };

  it("recommends the first lesson that is not finished", async () => {
    const { wrapper } = await open({ "basis-a": { status: "completed", stepIndex: 7, bestScore: 0.9 }, "basis-b": { status: "in_progress", stepIndex: 2 } });
    const rows = wrapper.findAll("ol > li");
    expect(rows[0].text()).not.toContain("Volgende");
    expect(rows[1].text()).toContain("Volgende");
    expect(rows[2].text()).not.toContain("Volgende");
  });

  it("shows best score for finished lessons and the step for lessons in progress", async () => {
    const { wrapper } = await open({ "basis-a": { status: "completed", stepIndex: 7, bestScore: 0.86 }, "basis-b": { status: "in_progress", stepIndex: 2 } });
    const rows = wrapper.findAll("ol > li").map((r) => r.text());
    expect(rows[0]).toContain("beste score 86%");
    expect(rows[0]).toContain("✓");
    expect(rows[1]).toContain("bezig (stap 3)");
    expect(rows[2]).toContain("15 min · 11 stappen");
  });

  it("when everything is finished nothing is recommended", async () => {
    const done = { status: "completed", stepIndex: 1, bestScore: 1 };
    const { wrapper } = await open({ "basis-a": done, "basis-b": done, "basis-c": done });
    expect(wrapper.text()).not.toContain("Volgende");
  });

  it("a module without lessons says lessons are coming", async () => {
    const { wrapper } = await open({}, "exams");
    expect(wrapper.text()).toContain("Hier komen later lessen.");
  });

  it("only the writing module links to 'Mijn teksten en feedback'", async () => {
    fakeApi.on("GET", "/course", { ...course, modules: [...course.modules, { id: "schrijven", title: "Schrijven", description: "", icon: "", units: [] }] });
    const writing = await open({}, "schrijven");
    expect(writing.wrapper.find("a[href='/schrijven/geschiedenis']").exists()).toBe(true);
    const basis = await open({});
    expect(basis.wrapper.find("a[href='/schrijven/geschiedenis']").exists()).toBe(false);
  });
});
