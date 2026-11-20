// @vitest-environment jsdom
// Taalcafé: small talk with Sanne (Claude). Every message of the learner comes back corrected, with the wrong part
// struck through and the right way next to it, the same as the writing feedback.
import { beforeEach, describe, expect, it, vi } from "vitest";
import TaalcafeView from "../../../src/views/TaalcafeView.vue";
import { TAALCAFE_MAX_TURNS } from "../../../shared/logic/taalcafe";
import { buttonWith, clickButton, deferred, fakeApi, flushPromises, mountApp } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

const WEEKEND_OPENER = "Hoi! Fijn dat je er bent. Wat heb je afgelopen weekend gedaan?";
const fix = { original: "ik heb gaan", corrected: "ik ben gegaan", type: "werkwoord", explanation: "Gaan krijgt zijn." };

async function open({ hasKey = true } = {}) {
  fakeApi.on("GET", "/settings", { apiKey: hasKey ? "sk-…" : null, spellcheckWriting: false });
  const m = await mountApp(TaalcafeView);
  return m.wrapper;
}
const box = (w: Awaited<ReturnType<typeof open>>) => w.find("textarea");
async function type(w: Awaited<ReturnType<typeof open>>, text: string) {
  await box(w).setValue(text);
}
const learnerBubbles = (w: Awaited<ReturnType<typeof open>>) => w.findAll("[data-from=learner]");
const partnerBubbles = (w: Awaited<ReturnType<typeof open>>) => w.findAll("[data-from=partner]");

beforeEach(() => fakeApi.reset());

describe("without a Claude key", () => {
  it("says the taalcafé needs a key and links to Settings, without topics or any call to Claude", async () => {
    const w = await open({ hasKey: false });
    expect(w.text()).toContain("Het taalcafé werkt met Claude. Voeg een API-sleutel toe bij");
    expect(w.find("a[href='/instellingen']").exists()).toBe(true);
    expect(buttonWith(w, "Het weekend")).toBeUndefined();
    expect(fakeApi.to("POST", "/claude/taalcafe")).toHaveLength(0);
  });
});

describe("a conversation", () => {
  it("starts with Sanne's first line for the chosen topic", async () => {
    const w = await open();
    await clickButton(w, "Het weekend");
    expect(partnerBubbles(w).map((b) => b.text())).toEqual([expect.stringContaining(WEEKEND_OPENER)]);
    expect(w.text()).toContain("Onderwerp: Het weekend");
  });

  it("sends the topic, the talk so far and the message, then shows the message corrected and Sanne's answer", async () => {
    fakeApi.on("POST", "/claude/taalcafe", { reply: "Leuk! Welke film?", corrections: [fix] });
    const w = await open();
    await clickButton(w, "Het weekend");
    await type(w, "  Zaterdag ik heb gaan naar de bioscoop  ");
    await clickButton(w, "Verstuur");

    expect(fakeApi.to("POST", "/claude/taalcafe").map((c) => c.body)).toEqual([
      { topicId: "weekend", history: [{ from: "partner", text: WEEKEND_OPENER }], message: "Zaterdag ik heb gaan naar de bioscoop" },
    ]);
    const mine = learnerBubbles(w)[0];
    expect(mine.find("del").text()).toBe("ik heb gaan");
    expect(mine.find("ins").text()).toBe("ik ben gegaan");
    expect(mine.text()).toContain("Gaan krijgt zijn.");
    expect(partnerBubbles(w).at(-1)!.text()).toContain("Leuk! Welke film?");
    expect((box(w).element as HTMLTextAreaElement).value).toBe("");
  });

  it("says a message without mistakes is well written, and the next turn sends the whole talk", async () => {
    let n = 0;
    fakeApi.on("POST", "/claude/taalcafe", () => ({ reply: ++n === 1 ? "Wat leuk!" : "Mooi.", corrections: [] }));
    const w = await open();
    await clickButton(w, "Het weekend");
    await type(w, "Ik ben naar het strand gegaan.");
    await clickButton(w, "Verstuur");
    expect(learnerBubbles(w)[0].text()).toContain("Goed geschreven!");
    expect(learnerBubbles(w)[0].find("del").exists()).toBe(false);

    await type(w, "Het was mooi weer.");
    await clickButton(w, "Verstuur");
    expect(fakeApi.to("POST", "/claude/taalcafe")[1].body).toMatchObject({
      history: [
        { from: "partner", text: WEEKEND_OPENER },
        { from: "learner", text: "Ik ben naar het strand gegaan." },
        { from: "partner", text: "Wat leuk!" },
      ],
      message: "Het was mooi weer.",
    });
  });

  it("sends with Enter, but Shift + Enter only starts a new line", async () => {
    fakeApi.on("POST", "/claude/taalcafe", { reply: "Ja!", corrections: [] });
    const w = await open();
    await clickButton(w, "Het weer");
    await type(w, "Het regent");
    await box(w).trigger("keydown", { key: "Enter", shiftKey: true });
    await flushPromises();
    expect(fakeApi.to("POST", "/claude/taalcafe")).toHaveLength(0);
    await box(w).trigger("keydown", { key: "Enter" });
    await flushPromises();
    expect(fakeApi.to("POST", "/claude/taalcafe")).toHaveLength(1);
  });

  it("sends nothing for an empty message, and only once while Sanne is still answering", async () => {
    const pending = deferred();
    fakeApi.on("POST", "/claude/taalcafe", () => pending.promise);
    const w = await open();
    await clickButton(w, "Het weer");
    await type(w, "   ");
    await box(w).trigger("keydown", { key: "Enter" });
    expect(fakeApi.to("POST", "/claude/taalcafe")).toHaveLength(0);

    await type(w, "Het regent");
    await box(w).trigger("keydown", { key: "Enter" });
    await type(w, "Het regent weer");
    await box(w).trigger("keydown", { key: "Enter" });
    await box(w).trigger("keydown", { key: "Enter" });
    expect(fakeApi.to("POST", "/claude/taalcafe")).toHaveLength(1);
    expect(w.text()).toContain("Sanne schrijft…");
    pending.resolve({ reply: "Ja, echt herfst!", corrections: [] });
    await flushPromises();
    expect(w.text()).not.toContain("Sanne schrijft…");
  });

  it("when Claude fails, puts the message back in the box and sends it again on retry", async () => {
    fakeApi.fail("POST", "/claude/taalcafe", "Claude is even niet bereikbaar.");
    const w = await open();
    await clickButton(w, "Het weer");
    await type(w, "Het is koud");
    await clickButton(w, "Verstuur");

    expect(w.find("[role=alert]").text()).toContain("Claude is even niet bereikbaar.");
    expect((box(w).element as HTMLTextAreaElement).value).toBe("Het is koud");
    expect(learnerBubbles(w)).toHaveLength(0);

    fakeApi.on("POST", "/claude/taalcafe", { reply: "Ja, brr!", corrections: [] });
    await clickButton(w, "Opnieuw proberen");
    expect(fakeApi.to("POST", "/claude/taalcafe")).toHaveLength(2);
    expect(learnerBubbles(w).map((b) => b.text())).toEqual([expect.stringContaining("Het is koud")]);
    expect(w.find("[role=alert]").exists()).toBe(false);
  });

  it("a new conversation goes back to the topics, and a late answer from the old one is not shown", async () => {
    const pending = deferred();
    fakeApi.on("POST", "/claude/taalcafe", () => pending.promise);
    const w = await open();
    await clickButton(w, "Het weer");
    await type(w, "Het regent");
    await clickButton(w, "Verstuur");
    await clickButton(w, "Nieuw gesprek");
    expect(buttonWith(w, "Het weekend")).toBeDefined();

    await clickButton(w, "Eten en koken");
    pending.resolve({ reply: "Antwoord over het weer", corrections: [] });
    await flushPromises();
    expect(w.text()).not.toContain("Antwoord over het weer");
    expect(learnerBubbles(w)).toHaveLength(0);
    expect(partnerBubbles(w)).toHaveLength(1);
  });

  it(`stops after ${TAALCAFE_MAX_TURNS} messages and warns when only a few are left`, async () => {
    fakeApi.on("POST", "/claude/taalcafe", { reply: "Ja.", corrections: [] });
    const w = await open();
    await clickButton(w, "Het weer");
    for (let i = 1; i <= TAALCAFE_MAX_TURNS; i++) {
      await type(w, `bericht ${i}`);
      await clickButton(w, "Verstuur");
      if (i === TAALCAFE_MAX_TURNS - 5) expect(w.text()).toContain("Nog 5 berichten in dit gesprek.");
    }
    expect(w.text()).toContain("Goed gesprek! Begin een nieuw gesprek");
    expect(w.find("textarea").exists()).toBe(false);
    expect(fakeApi.to("POST", "/claude/taalcafe")).toHaveLength(TAALCAFE_MAX_TURNS);
  });
});
