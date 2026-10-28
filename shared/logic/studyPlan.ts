import { addDays } from "./srs.js";

export type ExamSkill = "lezen" | "luisteren" | "knm" | "schrijven";
export const EXAM_SKILLS: readonly ExamSkill[] = ["lezen", "luisteren", "knm", "schrijven"];
/** The learner's real exam dates (YYYY-MM-DD), set in Instellingen. */
export type ExamDates = Partial<Record<ExamSkill, string>>;

export interface PlanTask {
  kind: "lesson" | "exam";
  id: string;
  title: string;
  /** Module of a lesson, skill of a mock exam. */
  moduleId: string;
  minutes: number;
}

export interface PlanInput {
  today: string;
  examDates: ExamDates;
  /** Lessons not finished yet, in course order. */
  lessons: PlanTask[];
  /** Mock exams not handed in yet. */
  mockExams: (PlanTask & { moduleId: ExamSkill })[];
}

export interface PlanExam {
  skill: ExamSkill;
  date: string;
  daysLeft: number;
  lessonsLeft: number;
  mockExamsLeft: number;
}

export interface PlanWeek {
  start: string;
  end: string;
  tasks: (PlanTask & { day: string })[];
  /** Real exams that fall in this week. */
  exams: ExamSkill[];
}

export interface StudyPlan {
  today: string;
  /** Exams from today on, soonest first. */
  exams: PlanExam[];
  /** Minutes a day needed from today to be ready for every exam in time. */
  minutesPerDay: number;
  weeks: PlanWeek[];
}

/** Whole days from `a` to `b` (both YYYY-MM-DD). UTC, so a DST change does not make a day 23 hours. */
export function daysBetween(a: string, b: string): number {
  const utc = (d: string) => {
    const [y, m, day] = d.split("-").map(Number);
    return Date.UTC(y, m - 1, day);
  };
  return Math.round((utc(b) - utc(a)) / 86_400_000);
}

/** A real calendar day as YYYY-MM-DD (not "2026-02-31"). */
export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && addDays(s, 0) === s;

/**
 * Spread the remaining lessons and mock exams over the days before the exams.
 * A skill's lessons and mock exams must be done before that exam; Basis is needed for every exam, so before the first one.
 * Each day does what is needed to stay on time for *every* coming exam (the busiest deadline sets the pace),
 * so the plan is never later than needed and the load is as even as it can be. Lessons without an exam date are left out.
 */
export function buildStudyPlan(input: PlanInput): StudyPlan | null {
  const upcoming = EXAM_SKILLS.flatMap((skill) => {
    const date = input.examDates[skill];
    return date && isDay(date) && date >= input.today ? [{ skill, date }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date));
  if (!upcoming.length) return null;

  const dateOf = new Map(upcoming.map((e) => [e.skill as string, e.date]));
  // There is no study day left for an exam that is today: its work is not planned.
  const firstDeadline = upcoming.find((e) => e.date > input.today)?.date;
  const deadline = (t: PlanTask) => (t.moduleId === "basis" ? firstDeadline : dateOf.get(t.moduleId));
  const kindRank = (t: PlanTask) => (t.moduleId === "basis" ? 0 : t.kind === "lesson" ? 1 : 2);

  const queue = [...input.lessons, ...input.mockExams]
    .map((task, order) => ({ task, due: deadline(task), order }))
    .filter((x): x is { task: PlanTask; due: string; order: number } => !!x.due && x.due > input.today)
    .sort((a, b) => a.due.localeCompare(b.due) || kindRank(a.task) - kindRank(b.task) || a.order - b.order);

  const days: { day: string; tasks: PlanWeek["tasks"] }[] = [];
  let minutesPerDay = 0;
  // Minutes planned but not used yet (a 15-minute lesson does not fit in a 6-minute day: it waits for the next one).
  let carry = 0;
  for (let day = input.today; queue.length; day = addDays(day, 1)) {
    // The pace today: for each coming deadline, the work due by then divided by the days left before it.
    let pace = 0;
    let due = 0;
    for (const [i, x] of queue.entries()) {
      due += x.task.minutes;
      if (i === queue.length - 1 || queue[i + 1].due !== x.due) pace = Math.max(pace, due / daysBetween(day, x.due));
    }
    if (day === input.today) minutesPerDay = Math.ceil(pace);
    // A task is planned when at least half of it fits. Working ahead is not carried: the next pace already counts it.
    let left = carry + pace;
    const tasks: PlanWeek["tasks"] = [];
    while (queue.length && left >= queue[0].task.minutes / 2) {
      const { task } = queue.shift()!;
      tasks.push({ ...task, day });
      left -= task.minutes;
    }
    carry = Math.max(left, 0);
    days.push({ day, tasks });
  }

  const lastDay = upcoming[upcoming.length - 1].date;
  const weeks: PlanWeek[] = [];
  for (let start = input.today; start <= lastDay; start = addDays(start, 7)) {
    const end = addDays(start, 6);
    const tasks = days.filter((d) => d.day >= start && d.day <= end).flatMap((d) => d.tasks);
    const exams = upcoming.filter((e) => e.date >= start && e.date <= end).map((e) => e.skill);
    if (tasks.length || exams.length) weeks.push({ start, end, tasks, exams });
  }

  return {
    today: input.today,
    exams: upcoming.map(({ skill, date }) => ({
      skill,
      date,
      daysLeft: daysBetween(input.today, date),
      lessonsLeft: input.lessons.filter((l) => l.moduleId === skill || l.moduleId === "basis").length,
      mockExamsLeft: input.mockExams.filter((m) => m.moduleId === skill).length,
    })),
    minutesPerDay,
    weeks,
  };
}
