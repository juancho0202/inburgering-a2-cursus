// @vitest-environment jsdom
// "Wanneer is je examen?" on the end screen of a lesson or mock exam. When it is due is decided by the service
// (tests/unit/exam-prompt.test.ts); here: what the card does with the learner's answer.
import { beforeEach, describe, expect, it, vi } from "vitest";
import ExamDateCard from "../../../src/components/ExamDateCard.vue";
import { buttonWith, clickButton, fakeApi, flushPromises, mountApp } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

const settings = { apiKey: null, theme: "system", examDates: {}, examPrompt: { shown: 1, never: false } };
beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("POST", "/exam-prompt", { show: true });
  fakeApi.on("PUT", "/settings", (body: any) => ({ ...settings, examDates: body.examDates }));
  fakeApi.on("POST", "/exam-prompt/stop", { ok: true });
});
const open = () => mountApp(ExamDateCard);
const card = (w: any) => w.find("section");
const typeDate = async (w: any, label: string, value: string) => {
  const input = w.findAll("label").find((l: any) => l.text().includes(label))!.find("input");
  await input.setValue(value);
};

describe("ExamDateCard", () => {
  it("asks the service once, and shows nothing when it is not due", async () => {
    fakeApi.on("POST", "/exam-prompt", { show: false });
    const { wrapper } = await open();
    expect(fakeApi.to("POST", "/exam-prompt")).toHaveLength(1);
    expect(card(wrapper).exists()).toBe(false);
  });

  it("shows nothing when the service cannot answer (the end screen is complete without it)", async () => {
    fakeApi.fail("POST", "/exam-prompt", "Database niet beschikbaar.");
    const { wrapper } = await open();
    expect(card(wrapper).exists()).toBe(false);
    expect(wrapper.text()).not.toContain("Database");
  });

  it("'Opslaan' waits for a date, then saves only the filled-in dates and points to the plan", async () => {
    const { wrapper } = await open();
    expect(buttonWith(wrapper, "Opslaan")!.attributes("disabled")).toBeDefined();
    await typeDate(wrapper, "KNM", "2026-11-26");
    await typeDate(wrapper, "Lezen", "2027-01-14");
    await typeDate(wrapper, "Lezen", ""); // changed their mind
    await clickButton(wrapper, "Opslaan");
    expect(fakeApi.to("PUT", "/settings").map((c) => c.body)).toEqual([{ examDates: { knm: "2026-11-26" } }]);
    expect(card(wrapper).text()).toContain("Opgeslagen. Je studieplan staat op de startpagina.");
    expect(card(wrapper).find("a").attributes("href")).toBe("/");
  });

  it("a failed save says so and keeps the dates, so the learner can try again", async () => {
    fakeApi.fail("PUT", "/settings", "Opslaan mislukt.");
    const { wrapper } = await open();
    await typeDate(wrapper, "KNM", "2026-11-26");
    await clickButton(wrapper, "Opslaan");
    expect(wrapper.find("[role=alert]").text()).toContain("De datum kon niet worden opgeslagen.");
    expect(buttonWith(wrapper, "Opslaan")!.attributes("disabled")).toBeUndefined();
    fakeApi.on("PUT", "/settings", (body: any) => ({ ...settings, examDates: body.examDates }));
    await clickButton(wrapper, "Opslaan");
    expect(fakeApi.to("PUT", "/settings").at(-1)!.body).toEqual({ examDates: { knm: "2026-11-26" } });
    expect(wrapper.find("[role=alert]").exists()).toBe(false);
  });

  it("'Later' just closes the card; it stays possible to ask another time", async () => {
    const { wrapper } = await open();
    await clickButton(wrapper, "Later");
    expect(card(wrapper).exists()).toBe(false);
    expect(fakeApi.to("POST", "/exam-prompt/stop")).toHaveLength(0);
    expect(fakeApi.to("PUT", "/settings")).toHaveLength(0);
  });

  it("'Niet meer vragen' and 'Later' stop the question for good", async () => {
    const { wrapper } = await open();
    await wrapper.find("input[type=checkbox]").setValue(true);
    await clickButton(wrapper, "Later");
    expect(fakeApi.to("POST", "/exam-prompt/stop")).toHaveLength(1);
    expect(card(wrapper).exists()).toBe(false);
  });

  it("when 'Niet meer vragen' cannot be saved, the card stays with a message", async () => {
    fakeApi.fail("POST", "/exam-prompt/stop", "Opslaan mislukt.");
    const { wrapper } = await open();
    await wrapper.find("input[type=checkbox]").setValue(true);
    await clickButton(wrapper, "Later");
    await flushPromises();
    expect(wrapper.find("[role=alert]").text()).toContain("Dit kon niet worden opgeslagen.");
    expect(buttonWith(wrapper, "Later")!.attributes("disabled")).toBeUndefined();
  });
});
