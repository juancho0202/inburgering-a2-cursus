import { describe, expect, it } from "vitest";
import { collectContentIds, missingIds } from "../../shared/content/ids";
import { loadCourse } from "../../scripts/courseFiles";
import fs from "node:fs";

describe("stable content ids", () => {
  it("collects ids of units, lessons, exercises, reading questions, words, verbs and exam items", async () => {
    const { data } = await loadCourse();
    const ids = collectContentIds(data);
    for (const id of ["basis", "basis-tijd", "basis-tijd-l-01", "basis-tijd-q-001", "knm-wonen-q-001", "lezen-brieven-q-001-1", "basis-verb-werken", "exam-knm-1", "exam-knm-1-q-001", "exam-lezen-1-q-001-1"]) {
      expect(ids, id).toContain(id);
    }
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([...ids].sort());
  });

  it("finds ids that disappeared, but not new ones", () => {
    expect(missingIds(["a", "b", "c"], ["a", "c", "d"])).toEqual(["b"]);
    expect(missingIds(["a"], ["a", "b"])).toEqual([]);
  });

  it("the committed baseline is still complete (renaming or deleting an id must be a conscious step)", async () => {
    const { data } = await loadCourse();
    const baseline: string[] = JSON.parse(fs.readFileSync("data/content-ids.json", "utf-8")).ids;
    expect(missingIds(baseline, collectContentIds(data))).toEqual([]);
  });
});
