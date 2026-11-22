// Taalcafé word levels: which words count (static lists, no Claude), the lists themselves, and the levels won
// (saved, carried to another device in the progress file, wiped with a reset).
import { describe, expect, it } from "vitest";
import { TAALCAFE_TOPICS } from "../../shared/logic/taalcafe";
import { TOPIC_LEVELS, WORDS_SHOWN, topicLevels, wordsUsed, type TopicWord } from "../../shared/logic/taalcafeWords";
import { planMerge, isNothingNew } from "../../shared/logic/merge";
import { emptyProgressData } from "../../shared/schemas/transfer";
import { createApiRouter } from "../../shared/services/router";
import { resetProgress } from "../../shared/services/progress";
import { getTaalcafeLevels, winTaalcafeLevel } from "../../shared/services/taalcafe";
import { applyImport, buildProgressFile, parseProgressFile, undoLastImport } from "../../shared/services/transfer";
import { makeClock, makeEnv } from "../helpers/fixtures";

const w = (forms: string): TopicWord => ({ word: forms.split("|")[0], forms: forms.split("|").map((f) => f.toLowerCase()) });
const used = (text: string, words: TopicWord[], corrections: { original: string; corrected: string; type: string; explanation: string }[] = []) =>
  wordsUsed(text, corrections, words).map((x) => x.word);

describe("which words count", () => {
  const slapen = w("slapen|slaap|sliep|geslapen");
  it("any form counts, in any case, as a whole word only", () => {
    expect(used("Ik heb lang GESLAPEN.", [slapen])).toEqual(["slapen"]);
    expect(used("Ik sliep.", [slapen])).toEqual(["slapen"]);
    expect(used("Ik ben slaperig.", [slapen])).toEqual([]); // part of another word
    expect(used("Zonder jas", [w("zon|zonnig")])).toEqual([]);
  });

  it("a phrase counts only as the same words in a row, and apostrophes and accents are kept", () => {
    const op = w("op vakantie");
    expect(used("We gaan op vakantie!", [op])).toEqual(["op vakantie"]);
    expect(used("Op de vakantie", [op])).toEqual([]);
    expect(used("Twee paraplu’s", [w("paraplu|paraplu's")])).toEqual(["paraplu"]);
    expect(used("Welke ingrediënten?", [w("ingrediënten|ingredienten")])).toEqual(["ingrediënten"]);
  });

  it("a word inside a corrected chunk does not count, and a phrase is not glued together across a correction", () => {
    const fix = { original: "ik heb slaap", corrected: "ik heb geslapen", type: "werkwoord", explanation: "x" };
    expect(used("Zondag ik heb slaap.", [slapen, w("zondag")], [fix])).toEqual(["zondag"]);
    const middle = { original: "gaan", corrected: "gingen", type: "werkwoord", explanation: "x" };
    expect(used("op gaan vakantie", [w("op vakantie")], [middle])).toEqual([]);
  });
});

describe("the word lists", () => {
  it("every topic has levels of six different words, more than are shown at once; level 1 starts with the topic's opener", () => {
    for (const t of TAALCAFE_TOPICS) {
      const levels = topicLevels(t.id);
      expect(levels.length, t.id).toBeGreaterThanOrEqual(2);
      expect(levels[0].opener, t.id).toBe(t.opener);
      for (const l of levels) {
        expect(l.words, t.id).toHaveLength(6);
        expect(l.words.length).toBeGreaterThan(WORDS_SHOWN);
        expect(l.opener.trim(), t.id).toBeTruthy();
      }
      // One word once per topic: the screen and the server know a word by its text.
      const all = levels.flatMap((l) => l.words.map((x) => x.word));
      expect(new Set(all).size, t.id).toBe(all.length);
    }
    expect(Object.keys(TOPIC_LEVELS).sort()).toEqual(TAALCAFE_TOPICS.map((t) => t.id).sort());
  });

  it("the word itself is always one of its forms, so writing exactly what is shown counts", () => {
    for (const levels of Object.values(TOPIC_LEVELS))
      for (const l of levels) for (const x of l.words) expect(used(`Dit is ${x.word}.`, [x]), x.word).toEqual([x.word]);
  });
});

describe("levels won", () => {
  it("are kept per topic; winning a lower level again changes nothing; only real topics and levels", async () => {
    const { env } = makeEnv();
    expect(await getTaalcafeLevels(env)).toEqual({ levels: {} });
    expect(await winTaalcafeLevel(env, { topicId: "weekend", level: 1 })).toEqual({ levels: { weekend: 1 } });
    await winTaalcafeLevel(env, { topicId: "weekend", level: 2 });
    await winTaalcafeLevel(env, { topicId: "weekend", level: 1 });
    await winTaalcafeLevel(env, { topicId: "eten", level: 1 });
    expect(await getTaalcafeLevels(env)).toEqual({ levels: { weekend: 2, eten: 1 } });
    await expect(winTaalcafeLevel(env, { topicId: "weekend", level: 0 })).rejects.toMatchObject({ status: 400 });
    await expect(winTaalcafeLevel(env, { topicId: "weekend", level: topicLevels("weekend").length + 1 })).rejects.toMatchObject({ status: 400 });
    await expect(winTaalcafeLevel(env, { topicId: "nope", level: 1 })).rejects.toMatchObject({ status: 404 });
  });

  it("work through the router", async () => {
    const { env } = makeEnv();
    const api = createApiRouter(async () => env);
    expect((await api.handle("POST", "/taalcafe/levels", { topicId: "weer", level: 1 })).body).toEqual({ levels: { weer: 1 } });
    expect((await api.handle("GET", "/taalcafe/levels")).body).toEqual({ levels: { weer: 1 } });
  });

  it("go to another device in the progress file: per topic the highest level wins, and undo puts them back", async () => {
    const clock = makeClock();
    const laptop = makeEnv({ clock }).env;
    const phone = makeEnv({ clock }).env;
    await winTaalcafeLevel(laptop, { topicId: "weekend", level: 2 });
    await winTaalcafeLevel(laptop, { topicId: "eten", level: 1 });
    await winTaalcafeLevel(phone, { topicId: "eten", level: 3 });

    await applyImport(phone, { file: await buildProgressFile(laptop) });
    expect(await getTaalcafeLevels(phone)).toEqual({ levels: { weekend: 2, eten: 3 } });
    await undoLastImport(phone);
    expect(await getTaalcafeLevels(phone)).toEqual({ levels: { eten: 3 } });
  });

  it("a file with nothing higher adds nothing, and a file from before the levels still opens", async () => {
    const at = "2026-10-05T10:00:00.000Z";
    const local = { ...emptyProgressData(), taalcafeLevels: { levels: { eten: 3 }, updatedAt: at } };
    const plan = planMerge(local, { ...emptyProgressData(), taalcafeLevels: { levels: { eten: 2 }, updatedAt: at } });
    expect(plan.taalcafeLevels).toBeUndefined();
    expect(isNothingNew(plan)).toBe(true);
    expect(planMerge(local, { ...emptyProgressData(), taalcafeLevels: { levels: { eten: 3 }, updatedAt: at } }).taalcafeLevels).toBeUndefined();
    expect(planMerge(local, { ...emptyProgressData(), taalcafeLevels: { levels: { weer: 1 }, updatedAt: at } }).taalcafeLevels?.levels).toEqual({ eten: 3, weer: 1 });

    const { env } = makeEnv();
    const file = await buildProgressFile(env);
    const { taalcafeLevels: _gone, ...older } = file.data;
    expect(parseProgressFile({ ...file, data: older }).file.data.taalcafeLevels).toBeNull();
  });

  it("are wiped with a reset of the progress", async () => {
    const { env } = makeEnv();
    await winTaalcafeLevel(env, { topicId: "weekend", level: 1 });
    await resetProgress(env, { confirm: "RESET" });
    expect(await getTaalcafeLevels(env)).toEqual({ levels: {} });
  });
});
