// The taalcafé's own content (topics and situations): checked like course content, because a broken situation
// (two goals with the same id, a missing opener) would only show up halfway a conversation.
import { describe, expect, it } from "vitest";
import { TAALCAFE_TOPICS } from "../../shared/logic/taalcafe";
import { SITUATION_GROUPS, TAALCAFE_SITUATIONS } from "../../shared/logic/taalcafeSituations";
import { taalcafeSituationJsonSchema } from "../../shared/claude/schemas";

describe("taalcafé content", () => {
  it("every topic and situation has a unique id, and every situation is in a known group with at least one situation per group", () => {
    const ids = [...TAALCAFE_TOPICS.map((t) => t.id), ...TAALCAFE_SITUATIONS.map((s) => s.id)];
    expect(new Set(ids).size).toBe(ids.length);
    const groups = SITUATION_GROUPS.map((g) => g.id);
    for (const s of TAALCAFE_SITUATIONS) expect(groups, s.id).toContain(s.group);
    for (const g of groups) expect(TAALCAFE_SITUATIONS.some((s) => s.group === g), g).toBe(true);
  });

  it("every situation has a partner, a setting, an opener, a twist and three goals with their own ids", () => {
    for (const s of TAALCAFE_SITUATIONS) {
      expect(s.partner.name && s.partner.role && s.setting && s.opener && s.twist, s.id).toBeTruthy();
      expect(s.goals, s.id).toHaveLength(3);
      expect(new Set(s.goals.map((g) => g.id)).size, s.id).toBe(3);
    }
  });

  it("the answer schema only lets Claude name this situation's goals", () => {
    const schema = taalcafeSituationJsonSchema(["a", "b"]);
    expect(schema.properties.goalsReached.items.enum).toEqual(["a", "b"]);
    expect(schema.required).toContain("goalsReached");
  });
});
