import { describe, expect, it } from "vitest";
import { scene, spotFor } from "../../src/lib/illustrations";

describe("illustrations", () => {
  it("finds a scene with its alt text, and nothing for an unknown id", () => {
    expect(scene("keuken")?.alt).toContain("koffie");
    expect(scene("bestaat-niet")).toBeNull();
    expect(scene(undefined)).toBeNull();
  });

  it("uses the drawing the course names", () => {
    expect(spotFor({ id: "x-1", tags: ["knm:wonen"], spot: "hond" })?.alt).toBe("Een hond.");
  });

  it("picks a drawing that suits the topic, always the same one for the same question", () => {
    const wonen = ["Een Nederlands huis.", "Sleutels.", "Een verhuisdoos.", "Een plant."];
    for (const id of ["knm-wonen-q-001", "knm-wonen-q-002", "knm-wonen-q-003"]) {
      const a = spotFor({ id, tags: ["knm:wonen"] });
      expect(wonen).toContain(a?.alt);
      expect(spotFor({ id, tags: ["knm:wonen"] })).toEqual(a);
    }
  });

  it("puts drawings on both sides", () => {
    const sides = new Set(Array.from({ length: 20 }, (_, i) => spotFor({ id: `q-${i}`, tags: [] })?.side));
    expect(sides).toEqual(new Set(["left", "right"]));
  });
});
