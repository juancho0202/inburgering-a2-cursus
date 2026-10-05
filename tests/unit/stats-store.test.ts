import { describe, expect, it } from "vitest";
import { itemStats, minutesByDay, streakFrom } from "../../shared/logic/stats";
import { createMemoryStore } from "../../shared/store/memory";

const a = (itemId: string, correct: boolean, at: string, durationMs = 60_000) => ({ itemId, correct, at, durationMs });

describe("stats derived from attempts", () => {
  it("counts seen/correct and keeps the latest result, whatever the order", () => {
    const stats = itemStats([a("q1", true, "2026-10-01T10:00:00Z"), a("q1", false, "2026-10-03T10:00:00Z"), a("q1", true, "2026-10-02T10:00:00Z")]);
    expect(stats.q1).toEqual({ seen: 3, correct: 2, lastCorrect: false, lastSeenAt: "2026-10-03T10:00:00Z" });
  });

  it("is identical for two devices' attempts merged as a union (no double counting)", () => {
    const laptop = [a("q1", false, "2026-10-01T10:00:00Z"), a("q2", true, "2026-10-01T10:05:00Z")];
    const phone = [a("q1", true, "2026-10-02T09:00:00Z")];
    const merged = new Map([...laptop, ...phone, ...laptop].map((x) => [`${x.itemId}${x.at}`, x])); // same attempt twice → once
    expect(itemStats([...merged.values()]).q1).toMatchObject({ seen: 2, correct: 1, lastCorrect: true });
  });

  it("adds up minutes per local day", () => {
    const m = minutesByDay([a("q1", true, "2026-10-05T10:00:00", 90_000), a("q2", true, "2026-10-05T11:00:00", 30_000), a("q3", true, "2026-10-06T08:00:00", 60_000)]);
    expect(m).toEqual({ "2026-10-05": 2, "2026-10-06": 1 });
  });
});

describe("streak", () => {
  it("is 0 without activity", () => {
    expect(streakFrom([], "2026-10-05")).toEqual({ current: 0, best: 0, lastDay: null });
  });
  it("counts consecutive days ending today, and ending yesterday", () => {
    expect(streakFrom(["2026-10-03", "2026-10-04", "2026-10-05"], "2026-10-05").current).toBe(3);
    expect(streakFrom(["2026-10-03", "2026-10-04"], "2026-10-05").current).toBe(2); // not today yet: still alive
  });
  it("is 0 after a missed day, but remembers the best run", () => {
    const s = streakFrom(["2026-09-01", "2026-09-02", "2026-09-03", "2026-10-01"], "2026-10-05");
    expect(s.current).toBe(0);
    expect(s.best).toBe(3);
    expect(s.lastDay).toBe("2026-10-01");
  });
  it("handles month borders", () => {
    expect(streakFrom(["2026-09-30", "2026-10-01"], "2026-10-01").current).toBe(2);
  });
});

describe("memory store", () => {
  it("copies values so callers cannot change stored data", async () => {
    const store = createMemoryStore();
    const unit = { id: "u", status: "in_progress" as const, bestScore: null, attempts: 0, stepIndex: 1, completedAt: null, updatedAt: "x" };
    await store.units.put(unit);
    unit.stepIndex = 99;
    const read = await store.units.get("u");
    expect(read?.stepIndex).toBe(1);
    read!.stepIndex = 42;
    expect((await store.units.get("u"))?.stepIndex).toBe(1);
  });
  it("supports put/putMany/delete/all/clear and key-value", async () => {
    const store = createMemoryStore();
    await store.flags.putMany([{ id: "1", itemId: "a", note: "n", at: "t" }, { id: "2", itemId: "b", note: "n", at: "t" }]);
    expect(await store.flags.all()).toHaveLength(2);
    await store.flags.delete("1");
    expect((await store.flags.all()).map((f) => f.id)).toEqual(["2"]);
    await store.flags.clear();
    expect(await store.flags.all()).toEqual([]);
    await store.kv.set("k", { a: 1 });
    expect(await store.kv.get("k")).toEqual({ a: 1 });
    await store.kv.delete("k");
    expect(await store.kv.get("k")).toBeUndefined();
  });
});
