import { beforeAll, describe, expect, it } from "vitest";
import { buildContentData, contentFromData } from "../../shared/content/data";
import { validateContent } from "../../shared/content/validate";
import { loadCourse } from "../../scripts/courseFiles";

const course = JSON.stringify({ id: "c", title: "Cursus", modules: ["basis", "exams"] });
const mod = (id: string, units: string[]) => JSON.stringify({ id, title: id, description: "d", icon: "x", units });
const mc = (id: string, answer = 0, options = ["a", "b", "c"]) => ({ id, type: "mc", prompt: "p", options, answer, explanation: "e" });
const unit = (id: string, steps: unknown[], extra: object = {}) => JSON.stringify({ id, moduleId: "basis", title: id, goal: "g", estimatedMinutes: 5, steps, ...extra });
const ex = (exercise: unknown) => ({ type: "exercise", exercise });

const good = (): Record<string, string> => ({
  "course.json": course,
  "basis/module.json": mod("basis", ["basis-a"]),
  "exams/module.json": mod("exams", []),
  "basis/units/basis-a.json": unit("basis-a", [ex(mc("basis-a-q-001"))]),
  "basis/vocab/wonen.json": JSON.stringify({ theme: "wonen", title: "Wonen", entries: [{ id: "v1", nl: "de huur", article: "de", pos: "noun", definitionNl: "d", example: "e", level: "A2", source: "course" }] }),
  "basis/samenvatting.md": "# Samenvatting",
  "knm/facts/knm-werk.md": "- feit",
});
const problems = (files: Record<string, string>) => {
  const { data, errors } = buildContentData(files);
  return validateContent(data, errors);
};

describe("building the course data", () => {
  it("accepts a valid course and builds lookup maps in course order", () => {
    const { data, errors } = buildContentData(good());
    expect(errors).toEqual([]);
    expect(validateContent(data, errors)).toEqual([]);
    const c = contentFromData(data);
    expect([...c.modules.keys()]).toEqual(["basis", "exams"]);
    expect(c.units.get("basis-a")?.steps).toHaveLength(1);
    expect(c.vocabById.get("v1")?.nl).toBe("de huur");
    expect(c.samenvatting).toBe("# Samenvatting");
    expect(c.facts.get("knm-werk")).toBe("- feit");
  });

  it("applies schema defaults (tags, difficulty, passScore)", () => {
    const c = contentFromData(buildContentData(good()).data);
    const step = c.units.get("basis-a")!.steps[0];
    expect(step.type === "exercise" && step.exercise.tags).toEqual([]);
    expect(c.units.get("basis-a")!.passScore).toBe(0.7);
  });

  it("changes the version when content changes, and keeps it when nothing changes", () => {
    const a = buildContentData(good()).data.version;
    expect(buildContentData(good()).data.version).toBe(a);
    const changed = { ...good(), "basis/samenvatting.md": "# Anders" };
    expect(buildContentData(changed).data.version).not.toBe(a);
    expect(a).toMatch(/^[0-9a-f]{8}$/);
  });

  it("lists every problem at once, with file and path", () => {
    const files = { ...good(), "basis/units/basis-a.json": "{ kapot", "basis/vocab/wonen.json": JSON.stringify({ theme: "x" }) };
    const { errors } = buildContentData(files);
    expect(errors.map((e) => e.file).sort()).toEqual(["basis/units/basis-a.json", "basis/vocab/wonen.json"]);
    expect(errors.find((e) => e.file.includes("wonen"))!.message).toContain("title");
  });

  it("reports missing course/module files, files in the wrong place and a unit in the wrong module folder", () => {
    expect(buildContentData({}).errors[0]).toMatchObject({ file: "course.json" });
    expect(buildContentData({ ...good(), "basis/rommel.json": "{}" }).errors).toEqual([{ file: "basis/rommel.json", message: "Onbekend bestand: staat dit op de goede plek?" }]);
    expect(buildContentData({ ...good(), "knm/units/basis-a.json": unit("basis-a", []) }).errors[0].message).toContain('past niet bij de map "knm"');
    const { "exams/module.json": _m, ...withoutExams } = good();
    expect(buildContentData(withoutExams).errors).toEqual([{ file: "exams/module.json", message: "Bestand ontbreekt" }]);
  });
});

describe("validating the course", () => {
  it("finds duplicate ids, bad answer indexes, duplicate options and missing references", () => {
    const files = good();
    files["basis/units/basis-a.json"] = unit("basis-a", [ex(mc("dup")), ex(mc("dup", 7)), ex(mc("opt", 0, ["a", "a"]))], { vocabRefs: ["bestaat-niet"] });
    files["basis/module.json"] = mod("basis", ["basis-a", "basis-spook"]);
    const p = problems(files).join("\n");
    expect(p).toContain('Dubbel id "dup"');
    expect(p).toContain("Ongeldig answer-index bij dup");
    expect(p).toContain("Dubbele opties bij opt");
    expect(p).toContain('vocabRef "bestaat-niet"');
    expect(p).toContain('Module "basis" noemt de les "basis-spook"');
  });

  it("enforces the exam rules: no refs, 40 KNM questions, only the right item types", () => {
    const files = good();
    files["exams/exam-knm-x.json"] = JSON.stringify({ id: "exam-knm-x", skill: "knm", title: "t", durationMinutes: 45, passScore: 0.7, items: [mc("e1"), { ref: "basis-a-q-001" }, { ...mc("e2"), type: "true-false", statement: "s", answer: true }] });
    const p = problems(files).join("\n");
    expect(p).toContain("gebruik geen ref");
    expect(p).toContain("een KNM-examen heeft 40 vragen");
    expect(p).toContain("alleen meerkeuze en leestekst");
  });
});

describe("the real course", () => {
  let result: Awaited<ReturnType<typeof loadCourse>>;
  beforeAll(async () => {
    result = await loadCourse();
  });
  it("is valid, complete and has a content version", () => {
    expect(result.problems).toEqual([]);
    expect(result.data.version).toMatch(/^[0-9a-f]{8}$/);
    expect(result.data.samenvatting.length).toBeGreaterThan(1000);
    expect(Object.keys(result.data.facts)).toHaveLength(8);
  });
  it("lists exams as Lezen, KNM, Schrijven", () => {
    expect([...result.content.exams.values()].map((e) => e.skill)).toEqual(["lezen", "lezen", "knm", "knm", "schrijven", "schrijven"]);
  });
  it("keeps the demo unit out of the module list but available", () => {
    expect(result.content.modules.get("basis")!.units).not.toContain("basis-demo");
    expect(result.content.units.has("basis-demo")).toBe(true);
  });
});
