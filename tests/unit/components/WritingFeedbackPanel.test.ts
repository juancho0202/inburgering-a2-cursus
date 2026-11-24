// @vitest-environment jsdom
// Claude's feedback on a written text. Like the Taalcafé chat, each correction sits in the learner's own text
// and explains itself in a tooltip: on a tap, on hover, on keyboard focus.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VueWrapper } from "@vue/test-utils";
import WritingFeedbackPanel from "../../../src/components/WritingFeedbackPanel.vue";
import { fakeApi, flushPromises, mountApp, pressKey } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

const text = "Ik kan niet werken op Donderdag, omdat Ik moet mijn zoon brengen.";
const corrections = [
  { original: "Donderdag", corrected: "donderdag", type: "hoofdletter/leesteken", explanation: "Dagen schrijf je met een kleine letter." },
  { original: "omdat Ik moet mijn zoon brengen", corrected: "want ik moet mijn zoon brengen", type: "woordvolgorde", explanation: "Na omdat staat het werkwoord aan het eind. Met want blijft de volgorde gewoon." },
];
const feedback = (over: Record<string, unknown> = {}) => ({
  overall: "bijna", score: 6, criteria: [], missingPoints: [], corrections, correctedText: "x", strongPoints: [], nextTip: "Let op de hoofdletters.", ...over,
});

beforeEach(() => fakeApi.reset());

const chunks = (w: VueWrapper) => w.findAll("[data-fix]");
const tooltips = (w: VueWrapper) => w.findAll("[data-tooltip]");

describe("the corrections in the learner's own text", () => {
  async function mountPanel(f = feedback()) {
    const { wrapper } = await mountApp(WritingFeedbackPanel, { props: { text, feedback: f } });
    return wrapper;
  }

  it("each correction is a chunk in the text; a tap shows why, a second tap closes it", async () => {
    const w = await mountPanel();
    expect(w.text()).toContain("Tik op een verbetering");
    expect(chunks(w).map((c) => [c.find("del").text(), c.find("ins").text()])).toEqual([
      ["Donderdag", "donderdag"],
      ["omdat Ik moet mijn zoon brengen", "want ik moet mijn zoon brengen"],
    ]);
    expect(tooltips(w)).toHaveLength(0);

    await chunks(w)[1].trigger("click");
    expect(tooltips(w)).toHaveLength(1);
    expect(tooltips(w)[0].text()).toContain("Na omdat staat het werkwoord aan het eind.");
    expect(chunks(w)[1].attributes("aria-describedby")).toBe(tooltips(w)[0].attributes("id"));
    expect(chunks(w)[1].attributes("aria-expanded")).toBe("true");

    await chunks(w)[1].trigger("click");
    expect(tooltips(w)).toHaveLength(0);
  });

  it("tapping another correction swaps the explanation; there is only one at a time", async () => {
    const w = await mountPanel();
    await chunks(w)[0].trigger("click");
    await chunks(w)[1].trigger("click");
    expect(tooltips(w)).toHaveLength(1);
    expect(tooltips(w)[0].text()).toContain("Met want blijft de volgorde gewoon.");
    expect(tooltips(w)[0].text()).not.toContain("kleine letter");
  });

  it("Escape closes it and puts the focus back on the correction; a tap elsewhere also closes it", async () => {
    const w = await mountPanel();
    await chunks(w)[0].trigger("click");
    await pressKey("Escape", document);
    expect(tooltips(w)).toHaveLength(0);
    expect(document.activeElement).toBe(chunks(w)[0].element);

    await chunks(w)[0].trigger("click");
    document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    expect(tooltips(w)).toHaveLength(0);
  });

  it("without corrections: no chunks and no tap hint, but 'no mistakes found'", async () => {
    const w = await mountPanel(feedback({ corrections: [] }));
    expect(chunks(w)).toHaveLength(0);
    expect(w.text()).not.toContain("Tik op een verbetering");
    expect(w.text()).toContain("Geen fouten gevonden");
    expect(w.text()).toContain("Ik kan niet werken op Donderdag");
  });
});

describe("several panels on one page (the writing history, the exam result)", () => {
  it("each has its own tooltip: opening one closes the other, and their ids differ", async () => {
    const Host = {
      components: { WritingFeedbackPanel },
      setup: () => ({ text, f: feedback() }),
      template: `<div><section data-a><WritingFeedbackPanel :text="text" :feedback="f" /></section><section data-b><WritingFeedbackPanel :text="text" :feedback="f" /></section></div>`,
    };
    const { wrapper: w } = await mountApp(Host);
    const a = w.find("[data-a]");
    const b = w.find("[data-b]");
    await a.findAll("[data-fix]")[0].trigger("click");
    const idA = a.find("[data-tooltip]").attributes("id");

    // A real tap: the click bubbles to the document, where the other panel hears it.
    b.findAll("[data-fix]")[0].element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    await flushPromises();
    expect(a.find("[data-tooltip]").exists()).toBe(false);
    expect(b.find("[data-tooltip]").exists()).toBe(true);
    expect(b.find("[data-tooltip]").attributes("id")).not.toBe(idA);
  });
});
