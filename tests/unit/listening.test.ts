// Listening fragments outside the screen: the course rules, the recording's file name, what is read aloud,
// grading a Luisteren exam, practising its mistakes, and what Claude gets to see when it explains one.
import { describe, expect, it } from "vitest";
import { buildContentData } from "../../shared/content/data";
import { validateContent } from "../../shared/content/validate";
import { collectContentIds } from "../../shared/content/ids";
import { explain } from "../../shared/services/claude";
import { examMistakes, startExam, submitExam } from "../../shared/services/exams";
import { findExercise } from "../../shared/services/lookup";
import type { Exam, Exercise, Fragment, Unit } from "../../shared/types";
import { stepSegments } from "../../src/lib/announce";
import { fragmentKey, fragmentRecording } from "../../src/lib/fragments";
import { scoredItemIds } from "../../src/lib/unitScore";
import { fakeGateway, fixtureContent, makeEnv } from "../helpers/fixtures";

const fragment = (kind: Fragment["kind"] = "telefoon"): Fragment => ({
  kind,
  situation: "Yusuf belt de huisarts.",
  speakers: [
    { name: "Assistente", voice: "nathalie", phone: true },
    { name: "Yusuf", voice: "ronnie" },
  ],
  lines: [
    { speaker: "Assistente", nl: "Huisartsenpraktijk De Linde." },
    { speaker: "Yusuf", nl: "Kan ik vandaag komen?" },
    { speaker: "Assistente", nl: "Morgen om kwart over elf." },
  ],
});
const q = (id: string, answerLine = 2, answer = 0): Exercise => ({
  id, type: "mc", tags: [], prompt: `Vraag ${id}`, options: ["goed", "fout", "ook fout"], answer, explanation: "Uitleg.", difficulty: 1, answerLine,
});
const listening = (id: string, kind: Fragment["kind"] = "telefoon", n = 2): Extract<Exercise, { type: "listening" }> => ({
  id, type: "listening", tags: [`luisteren:${kind}`], prompt: "Luister.", explanation: "e", difficulty: 1,
  fragment: fragment(kind),
  questions: Array.from({ length: n }, (_, i) => q(`${id}-${i + 1}`, i)),
});

// ---------- the course rules ----------

const files = (exercise: unknown, exam?: unknown): Record<string, string> => ({
  "course.json": JSON.stringify({ id: "c", title: "C", modules: ["luisteren"] }),
  "luisteren/module.json": JSON.stringify({ id: "luisteren", title: "Luisteren", description: "d", icon: "x", units: ["luisteren-a"] }),
  "luisteren/units/luisteren-a.json": JSON.stringify({ id: "luisteren-a", moduleId: "luisteren", title: "A", goal: "g", estimatedMinutes: 5, steps: [{ type: "exercise", exercise }] }),
  ...(exam ? { "exams/exam-luisteren-t.json": JSON.stringify(exam) } : {}),
});
const problems = (exercise: unknown, exam?: unknown) => {
  const { data, errors } = buildContentData(files(exercise, exam));
  return validateContent(data, errors);
};
const withFragment = (change: (f: Fragment) => Fragment) => ({ ...listening("luisteren-a-q-001"), fragment: change(fragment()) });

describe("the course rules for listening", () => {
  it("accepts a well-formed fragment", () => {
    expect(problems(listening("luisteren-a-q-001"))).toEqual([]);
  });

  it("refuses a line by someone who is not one of the speakers", () => {
    const bad = withFragment((f) => ({ ...f, lines: [...f.lines, { speaker: "Dokter", nl: "Hallo." }] }));
    expect(problems(bad).join("\n")).toContain('spreker "Dokter", maar die staat niet bij speakers');
  });

  it("refuses two speakers with the same voice: you could not hear who is talking", () => {
    const bad = withFragment((f) => ({ ...f, speakers: [f.speakers[0], { name: "Yusuf", voice: "nathalie" }] }));
    expect(problems(bad).join("\n")).toContain("Twee sprekers met dezelfde stem");
  });

  it("refuses a speaker who says nothing", () => {
    const bad = withFragment((f) => ({ ...f, speakers: [...f.speakers, { name: "Bas", voice: "alex" }] }));
    expect(problems(bad).join("\n")).toContain('Spreker "Bas" zegt niets');
  });

  it("needs the line of every answer, and that line must exist", () => {
    const ex = listening("luisteren-a-q-001");
    const { answerLine: _, ...withoutLine } = ex.questions[0] as Exercise & { answerLine?: number };
    expect(problems({ ...ex, questions: [withoutLine, ex.questions[1]] }).join("\n")).toContain("luisteren-a-q-001-1: answerLine ontbreekt");
    expect(problems({ ...ex, questions: [q("luisteren-a-q-001-1", 3), ex.questions[1]] }).join("\n")).toContain("answerLine 3 bestaat niet (het fragment heeft 3 regels)");
    expect(problems({ ...ex, questions: [q("luisteren-a-q-001-1", 2), ex.questions[1]] })).toEqual([]);
  });

  it("allows only multiple-choice questions about a fragment", () => {
    const ex = listening("luisteren-a-q-001");
    const tf = { id: "luisteren-a-q-001-1", type: "true-false", prompt: "Klopt dit?", statement: "s", answer: true, explanation: "e", answerLine: 0 };
    expect(problems({ ...ex, questions: [tf] }).join("\n")).toContain("alleen meerkeuzevragen");
  });

  it("refuses an unknown voice", () => {
    const bad = withFragment((f) => ({ ...f, speakers: [f.speakers[0], { name: "Yusuf", voice: "pim" as never }] }));
    expect(problems(bad).length).toBeGreaterThan(0);
  });

  it("a Luisteren exam has only fragments, 25 questions in all", () => {
    const exam = (items: unknown[]) => ({ id: "exam-luisteren-t", skill: "luisteren", title: "T", durationMinutes: 45, passScore: 0.7, items });
    const ten = (n: number) => Array.from({ length: n }, (_, i) => listening(`exam-luisteren-t-q-${i}`, "gesprek", i < 5 ? 3 : 2));
    expect(problems(listening("luisteren-a-q-001"), exam(ten(10)))).toEqual([]); // 5×3 + 5×2 = 25
    expect(problems(listening("luisteren-a-q-001"), exam(ten(9))).join("\n")).toContain("een luisterexamen heeft 25 vragen (nu 23)");
    const withMc = exam([...ten(10), { ...q("exam-luisteren-t-q-x"), answerLine: undefined }]);
    expect(problems(listening("luisteren-a-q-001"), withMc).join("\n")).toContain("alleen luisterfragmenten in een luisterexamen");
  });
});

// ---------- the recording ----------

describe("the recording of a fragment", () => {
  it("gives each line its speaker's voice, and the telephone sound to whoever is on the phone", () => {
    expect(fragmentRecording(fragment()).lines.map((l) => [l.model, l.phone])).toEqual([
      ["nl_BE-nathalie-medium", true],
      ["nl_NL-ronnie-medium", false],
      ["nl_BE-nathalie-medium", true],
    ]);
  });

  it("puts everyone in a voicemail on the phone", () => {
    const vm: Fragment = { ...fragment("voicemail"), speakers: [{ name: "Ingrid", voice: "nathalie" }], lines: [{ speaker: "Ingrid", nl: "Hallo." }] };
    expect(fragmentRecording(vm).lines[0].phone).toBe(true);
  });

  it("gets a new file name when what you hear changes, not when only the situation or a name changes", () => {
    const f = fragment();
    expect(fragmentKey({ ...f, situation: "Anders." })).toBe(fragmentKey(f));
    const renamed = { ...f, speakers: [f.speakers[0], { ...f.speakers[1], name: "Samir" }], lines: f.lines.map((l) => (l.speaker === "Yusuf" ? { ...l, speaker: "Samir" } : l)) };
    expect(fragmentKey(renamed)).toBe(fragmentKey(f));
    expect(fragmentKey({ ...f, lines: [...f.lines.slice(0, 2), { speaker: "Assistente", nl: "Morgen om half twaalf." }] })).not.toBe(fragmentKey(f));
    expect(fragmentKey({ ...f, speakers: [f.speakers[0], { name: "Yusuf", voice: "alex" }] })).not.toBe(fragmentKey(f));
    expect(fragmentKey({ ...f, kind: "gesprek" })).not.toBe(fragmentKey(f));
  });
});

describe("reading a listening step aloud", () => {
  it("reads the instruction and who is talking where, but never the fragment itself", () => {
    const segs = stepSegments({ type: "exercise", exercise: listening("l") }, { first: false, unitTitle: "Afspraken" });
    expect(segs).toEqual([
      { id: "heading", text: "Luister." },
      { id: "situation", text: "Yusuf belt de huisarts." },
    ]);
  });

  it("reads nothing of a fragment in a lesson step (it has its own recording)", () => {
    const step = { type: "lesson" as const, id: "l", title: "Luister mee", blocks: [{ kind: "text" as const, md: "Luister." }, { kind: "fragment" as const, fragment: fragment() }] };
    expect(stepSegments(step, { first: false, unitTitle: "U" }).map((s) => s.id)).toEqual(["heading", "block-0"]);
  });
});

// ---------- in lessons, exams and with Claude ----------

const unitL: Unit = {
  id: "luisteren-a", moduleId: "luisteren", title: "Afspraken", goal: "g", estimatedMinutes: 10, tags: ["luisteren:afspraken"], vocabRefs: [], passScore: 0.7,
  steps: [{ type: "exercise", exercise: listening("luisteren-a-q-001") }],
};
const examL: Exam = {
  id: "exam-luisteren-t", skill: "luisteren", title: "Proef Luisteren", durationMinutes: 45, passScore: 0.7,
  items: [listening("exam-luisteren-t-q-001", "telefoon"), listening("exam-luisteren-t-q-002", "omroep")],
};
function env(gateway?: ReturnType<typeof fakeGateway>["gateway"]) {
  const content = fixtureContent();
  content.units.set(unitL.id, unitL);
  content.exams.set(examL.id, examL);
  return makeEnv({ content, ...(gateway ? { gateway: () => gateway } : {}) }).env;
}

describe("listening in lessons and exams", () => {
  it("counts each question about a fragment, keeps its id stable and finds it by id", async () => {
    expect(scoredItemIds(unitL)).toEqual(["luisteren-a-q-001-1", "luisteren-a-q-001-2"]);
    const ids = collectContentIds({ modules: [], units: [unitL], vocab: [], verbs: [], exams: [examL] } as never);
    expect(ids).toEqual(expect.arrayContaining(["luisteren-a-q-001-2", "exam-luisteren-t-q-002-1"]));
    expect((await findExercise(env(), "luisteren-a-q-001-2"))?.prompt).toBe("Vraag luisteren-a-q-001-2");
  });

  it("grades a Luisteren exam per kind of fragment", async () => {
    const e = env();
    const { result } = await startExam(e, "exam-luisteren-t");
    const done = await submitExam(e, result.id, { answers: { "exam-luisteren-t-q-001-1": [0], "exam-luisteren-t-q-001-2": [1], "exam-luisteren-t-q-002-1": [0] } });
    expect(done).toMatchObject({ score: 2, max: 4, byTheme: { "luisteren:telefoon": [1, 2], "luisteren:omroep": [1, 2] } });
  });

  it("practises the mistakes of a Luisteren exam with their fragment, and only the questions that were wrong", async () => {
    const e = env();
    const { result } = await startExam(e, "exam-luisteren-t");
    await submitExam(e, result.id, { answers: { "exam-luisteren-t-q-001-1": [1], "exam-luisteren-t-q-001-2": [0], "exam-luisteren-t-q-002-1": [0], "exam-luisteren-t-q-002-2": [0] } });
    const mistakes = await examMistakes(e, result.id);
    expect(mistakes).toHaveLength(1);
    expect(mistakes[0]).toMatchObject({ id: "exam-luisteren-t-q-001", type: "listening", fragment: { situation: "Yusuf belt de huisarts." } });
    expect((mistakes[0] as Extract<Exercise, { type: "listening" }>).questions.map((x) => x.id)).toEqual(["exam-luisteren-t-q-001-1"]);
    // the exam itself is not changed
    expect((examL.items[0] as Extract<Exercise, { type: "listening" }>).questions).toHaveLength(2);
  });

  it("gives Claude what was said when it explains a mistake about a fragment", async () => {
    const { gateway, calls } = fakeGateway(() => ({ explanation: "Uitleg", rule: null, extraExamples: [] }));
    const e = env(gateway);
    await explain(e, { itemId: "luisteren-a-q-001-1", learnerAnswer: 1 });
    await explain(e, { itemId: "exam-luisteren-t-q-002-2", learnerAnswer: 2 });
    for (const call of calls) {
      expect(call.user).toContain("Yusuf belt de huisarts.");
      expect(call.user).toContain("Assistente: Morgen om kwart over elf.");
    }
  });
});
