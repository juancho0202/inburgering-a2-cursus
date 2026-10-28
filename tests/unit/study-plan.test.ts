import { describe, expect, it } from "vitest";
import { buildStudyPlan, daysBetween, type PlanInput, type PlanTask } from "../../shared/logic/studyPlan";

const lesson = (id: string, moduleId: string, minutes = 10): PlanTask => ({ kind: "lesson", id, title: id, moduleId, minutes });
const mock = (id: string, skill: "lezen" | "knm" | "schrijven" | "luisteren", minutes = 45) => ({ kind: "exam" as const, id, title: id, moduleId: skill, minutes });
const plan = (p: Partial<PlanInput>) => buildStudyPlan({ today: "2026-10-28", examDates: {}, lessons: [], mockExams: [], ...p });
const order = (p: ReturnType<typeof plan>) => p!.weeks.flatMap((w) => w.tasks.map((t) => t.id));

describe("study plan", () => {
  it("without an exam date there is no plan", () => {
    expect(plan({ lessons: [lesson("basis-a", "basis")] })).toBeNull();
  });

  it("an exam date in the past or an invalid one is ignored", () => {
    expect(plan({ examDates: { knm: "2026-10-27", lezen: "2026-02-31" }, lessons: [lesson("knm-a", "knm")] })).toBeNull();
  });

  it("counts the days and lists the exams soonest first, with what is still to do for each", () => {
    const p = plan({
      examDates: { schrijven: "2026-12-10", knm: "2026-11-11" },
      lessons: [lesson("basis-a", "basis"), lesson("knm-a", "knm"), lesson("knm-b", "knm"), lesson("schrijven-a", "schrijven"), lesson("lezen-a", "lezen")],
      mockExams: [mock("exam-knm-1", "knm"), mock("exam-lezen-1", "lezen")],
    })!;
    expect(p.exams).toEqual([
      { skill: "knm", date: "2026-11-11", daysLeft: 14, lessonsLeft: 3, mockExamsLeft: 1 },
      { skill: "schrijven", date: "2026-12-10", daysLeft: 43, lessonsLeft: 2, mockExamsLeft: 0 },
    ]);
  });

  it("Basis comes first, then the lessons of the first exam, then its mock exam, then the next exam; skills without a date are left out", () => {
    const p = plan({
      examDates: { schrijven: "2026-12-10", knm: "2026-11-11" },
      lessons: [lesson("basis-a", "basis"), lesson("lezen-a", "lezen"), lesson("knm-a", "knm"), lesson("schrijven-a", "schrijven"), lesson("basis-b", "basis")],
      mockExams: [mock("exam-schrijven-1", "schrijven", 40), mock("exam-knm-1", "knm"), mock("exam-lezen-1", "lezen")],
    });
    expect(order(p)).toEqual(["basis-a", "basis-b", "knm-a", "exam-knm-1", "schrijven-a", "exam-schrijven-1"]);
  });

  it("everything for an exam is planned before the exam week ends, even when time is short", () => {
    const lessons = Array.from({ length: 12 }, (_, i) => lesson(`knm-${i}`, "knm", 15));
    const p = plan({ examDates: { knm: "2026-10-31" }, lessons, mockExams: [mock("exam-knm-1", "knm")] })!;
    // 3 study days (28, 29, 30) for 12 × 15 + 45 minutes.
    expect(p.minutesPerDay).toBe(75);
    expect(p.weeks).toHaveLength(1);
    expect(p.weeks[0]).toMatchObject({ start: "2026-10-28", end: "2026-11-03", exams: ["knm"] });
    expect(p.weeks[0].tasks).toHaveLength(13);
  });

  it("with plenty of time the work is spread out instead of crammed into the first week", () => {
    // 8 lessons of 10 minutes, 8 weeks: about one lesson a week.
    const lessons = Array.from({ length: 8 }, (_, i) => lesson(`lezen-${i}`, "lezen"));
    const p = plan({ examDates: { lezen: "2026-12-23" }, lessons })!;
    const perWeek = p.weeks.map((w) => w.tasks.length);
    expect(Math.max(...perWeek)).toBeLessThanOrEqual(2);
    expect(perWeek.reduce((a, b) => a + b, 0)).toBe(8);
    expect(p.weeks[0].tasks.length).toBeGreaterThan(0);
    expect(p.minutesPerDay).toBe(2);
  });

  it("a lesson is planned once about half of it fits in the minutes saved up, not left to the last days", () => {
    // 14 minutes over 8 days is 1.75 a day: after 4 days there are 7 minutes, half the lesson.
    const p = plan({ examDates: { knm: "2026-11-05" }, lessons: [lesson("knm-a", "knm", 14)] })!;
    expect(p.weeks[0].tasks).toMatchObject([{ id: "knm-a", day: "2026-10-31" }]);
  });

  it("whatever the dates and lessons, every task is planned once and before its own exam day", () => {
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const pick = <T>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
    const skills = ["lezen", "knm", "schrijven", "luisteren"] as const;
    for (let n = 0; n < 500; n++) {
      const examDates = Object.fromEntries(skills.filter(() => rnd() < 0.6).map((s) => [s, `2026-${pick(["11", "12"])}-${String(1 + Math.floor(rnd() * 28)).padStart(2, "0")}`]));
      const lessons = Array.from({ length: Math.floor(rnd() * 40) }, (_, i) => lesson(`l${i}`, pick(["basis", ...skills]), pick([10, 12, 15, 20, 25])));
      const mockExams = skills.filter(() => rnd() < 0.5).map((s) => mock(`exam-${s}`, s));
      const p = plan({ examDates, lessons, mockExams });
      if (!p) continue;
      const first = Object.values(examDates).sort()[0];
      const planned = p.weeks.flatMap((w) => w.tasks);
      for (const t of planned) expect(t.day < (t.moduleId === "basis" ? first : examDates[t.moduleId])).toBe(true);
      const expected = [...lessons, ...mockExams].filter((t) => t.moduleId === "basis" || t.moduleId in examDates);
      expect(planned.map((t) => t.id).sort()).toEqual(expected.map((t) => t.id).sort());
    }
  });

  it("the pace is set by the busiest deadline, not only by the first one", () => {
    // KNM in 10 days needs 1 lesson; Lezen in 11 days needs 20 lessons. Doing only KNM first would make Lezen impossible.
    const p = plan({
      examDates: { knm: "2026-11-07", lezen: "2026-11-08" },
      lessons: [lesson("knm-a", "knm"), ...Array.from({ length: 20 }, (_, i) => lesson(`lezen-${i}`, "lezen"))],
    })!;
    expect(p.minutesPerDay).toBe(20); // 210 minutes over 11 days, rounded up
  });

  it("the week of an exam is kept even when everything is already done", () => {
    const p = plan({ examDates: { knm: "2026-11-20" } })!;
    expect(p.weeks).toEqual([{ start: "2026-11-18", end: "2026-11-24", tasks: [], exams: ["knm"] }]);
    expect(p.exams[0]).toMatchObject({ lessonsLeft: 0, mockExamsLeft: 0 });
    expect(p.minutesPerDay).toBe(0);
  });

  it("an exam today is shown, but nothing is planned for it any more", () => {
    const p = plan({ examDates: { knm: "2026-10-28" }, lessons: [lesson("knm-a", "knm")] })!;
    expect(p.exams[0]).toMatchObject({ skill: "knm", daysLeft: 0, lessonsLeft: 1 });
    expect(p.weeks).toEqual([{ start: "2026-10-28", end: "2026-11-03", tasks: [], exams: ["knm"] }]);
  });

  it("days are counted on the calendar, also across the change to winter time", () => {
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
  });
});
