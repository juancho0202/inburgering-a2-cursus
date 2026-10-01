import { describe, expect, it } from "vitest";
import { addDays, newCard, pickDueCards, reviewCard } from "../../shared/logic/srs";
import { checkWordOrder, countWords, matchesAny, normalizeAnswer } from "../../shared/logic/answers";
import { hardItemIds, weakestTags } from "../../shared/logic/weakspots";

const TODAY = "2026-10-01";
const NOW = "2026-10-01T10:00:00.000Z";

describe("leitner scheduler", () => {
  const fresh = newCard("w1", "meaning", TODAY);

  it("goed moves up one box and uses that box's interval", () => {
    const c1 = reviewCard(fresh, "goed", TODAY, NOW);
    expect(c1.box).toBe(1);
    expect(c1.due).toBe("2026-10-02");
    const c2 = reviewCard(c1, "goed", TODAY, NOW);
    expect(c2.box).toBe(2);
    expect(c2.due).toBe("2026-10-03");
  });
  it("makkelijk jumps two boxes and caps at 5", () => {
    expect(reviewCard(fresh, "makkelijk", TODAY, NOW).box).toBe(2);
    const top = { ...fresh, box: 5 };
    expect(reviewCard(top, "makkelijk", TODAY, NOW)).toMatchObject({ box: 5, due: addDays(TODAY, 16) });
  });
  it("moeilijk keeps the box, due tomorrow", () => {
    const c = reviewCard({ ...fresh, box: 3 }, "moeilijk", TODAY, NOW);
    expect(c.box).toBe(3);
    expect(c.due).toBe("2026-10-02");
  });
  it("opnieuw resets to box 0, due today, counts a lapse", () => {
    const c = reviewCard({ ...fresh, box: 4 }, "opnieuw", TODAY, NOW);
    expect(c).toMatchObject({ box: 0, due: TODAY, lapses: 1, reps: 1 });
  });
  it("addDays crosses month borders", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
  it("picks reviews before new cards and honours the new-card limit", () => {
    const review = { ...newCard("r", "meaning", TODAY), reps: 2, box: 1 };
    const news = ["a", "b", "c"].map((id) => newCard(id, "meaning", TODAY));
    const future = { ...review, id: "f", due: "2026-10-05" };
    const picked = pickDueCards([...news, review, future], TODAY, { limit: 30, newAllowance: 2 });
    expect(picked.map((c) => c.refId)).toEqual(["r", "a", "b"]);
  });
});

describe("answer checking", () => {
  it("normalises case, spaces and accents", () => {
    expect(normalizeAnswer("  Één  Euro ")).toBe("een euro");
    expect(matchesAny("EEN", ["één"])).toBe(true);
    expect(matchesAny("", [""])).toBe(false);
  });
  it("checks word order including alternatives", () => {
    const tokens = ["Morgen", "ga", "ik", "naar", "school"];
    expect(checkWordOrder(tokens, tokens)).toBe(true);
    expect(checkWordOrder(["Ik", "ga", "morgen", "naar", "school"], tokens)).toBe(false);
    expect(checkWordOrder(["Ik", "ga", "morgen", "naar", "school"], tokens, [["Ik", "ga", "morgen", "naar", "school"]])).toBe(true);
  });
  it("counts words", () => {
    expect(countWords("  Hoi  Ahmed, hoe gaat het? ")).toBe(5);
    expect(countWords("")).toBe(0);
  });
});

describe("weak spots", () => {
  const items = {
    a: { seen: 4, correct: 1, lastCorrect: false, lastSeenAt: null },
    b: { seen: 3, correct: 3, lastCorrect: true, lastSeenAt: null },
    c: { seen: 3, correct: 1, lastCorrect: true, lastSeenAt: null },
  };
  it("finds hard items: wrong >=2 times and wrong last time", () => {
    expect(hardItemIds(items)).toEqual(["a"]);
  });
  it("ranks tags by accuracy", () => {
    const tags: Record<string, string[]> = { a: ["x"], b: ["y"], c: ["x"] };
    const result = weakestTags(items, (id) => tags[id] ?? []);
    expect(result.map((t) => t.tag)).toEqual(["x"]);
    expect(result[0].accuracy).toBeCloseTo(2 / 7);
  });
});
