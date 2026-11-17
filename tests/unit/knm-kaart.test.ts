import { describe, expect, it } from "vitest";
import { loadCourse } from "../../scripts/courseFiles";

// The exam shows a map and asks where a province lies; a missed province is a gap in the lessons.
const PROVINCES: Record<string, string> = {
  Groningen: "Groningen", Friesland: "Leeuwarden", Drenthe: "Assen", Overijssel: "Zwolle", Flevoland: "Lelystad", Gelderland: "Arnhem",
  Utrecht: "Utrecht", "Noord-Holland": "Haarlem", "Zuid-Holland": "Den Haag", Zeeland: "Middelburg", "Noord-Brabant": "'s-Hertogenbosch", Limburg: "Maastricht",
};

describe("knm-kaart", () => {
  it("teaches every province with its capital, in a lesson that shows the map, and asks about each one", async () => {
    const { content } = await loadCourse();
    const unit = content.units.get("knm-kaart")!;
    const lessons = unit.steps.flatMap((s) => (s.type === "lesson" ? [s] : []));
    const lessonText = JSON.stringify(lessons.map((l) => l.blocks));
    const questions = JSON.stringify(unit.steps.flatMap((s) => (s.type === "exercise" ? [s.exercise] : [])));
    expect(content.modules.get("knm")!.units).toContain("knm-kaart");
    expect(lessons.some((l) => l.blocks.some((b) => b.kind === "picture" && b.scene === "provincies"))).toBe(true);
    for (const [province, capital] of Object.entries(PROVINCES)) {
      expect(lessonText, `${province} in the lessons`).toContain(province);
      expect(lessonText, `${capital} in the lessons`).toContain(capital);
      expect(questions, `a question about ${province}`).toContain(province);
    }
  });
});
