// @vitest-environment jsdom
// The taalcafé's choice of conversation: tabs per kind of practice (topics, situations), by mouse and keyboard.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import TaalcafePicker from "../../../src/components/TaalcafePicker.vue";
import { flushPromises, mountApp } from "../../helpers/component";

const tabs = (w: Awaited<ReturnType<typeof mountApp>>["wrapper"]) => w.findAll("[role=tab]");
const selected = (w: Awaited<ReturnType<typeof mountApp>>["wrapper"]) => tabs(w).find((t) => t.attributes("aria-selected") === "true")!.text();

beforeEach(() => localStorage.removeItem("taalcafeTab"));
afterEach(() => vi.restoreAllMocks());

describe("TaalcafePicker", () => {
  it("opens on the topics; a topic is chosen with one click", async () => {
    const { wrapper } = await mountApp(TaalcafePicker);
    expect(selected(wrapper)).toContain("Onderwerpen");
    await wrapper.findAll("button").find((b) => b.text().includes("Het weer"))!.trigger("click");
    expect(wrapper.emitted("choose")![0][0]).toMatchObject({ kind: "topic", topic: { id: "weer" } });
  });

  it("the situations tab shows the situations in groups, says which are phone calls, and chooses one", async () => {
    const { wrapper } = await mountApp(TaalcafePicker);
    await tabs(wrapper)[1].trigger("click");
    expect(selected(wrapper)).toContain("Situaties");
    expect(wrapper.find("[role=tabpanel]").attributes("aria-labelledby")).toBe(tabs(wrapper)[1].attributes("id"));
    expect(wrapper.findAll("h3").map((h) => h.text())).toEqual(expect.arrayContaining(["Winkels en geld", "Onderweg", "Gezondheid"]));
    expect(wrapper.find("[data-situation=huisarts-bellen]").text()).toContain("Telefoongesprek");
    expect(wrapper.find("[data-situation=apotheek]").text()).not.toContain("Telefoongesprek");
    await wrapper.find("[data-situation=ijsbaan]").trigger("click");
    expect(wrapper.emitted("choose")![0][0]).toMatchObject({ kind: "situation", situation: { id: "ijsbaan", partner: { name: "Lotte" } } });
  });

  it("works with the keyboard: arrow keys, Home and End switch tabs and move the focus; only the chosen tab is in the tab order", async () => {
    const { wrapper } = await mountApp(TaalcafePicker);
    expect(tabs(wrapper).map((t) => t.attributes("tabindex"))).toEqual(["0", "-1"]);
    await tabs(wrapper)[0].trigger("keydown", { key: "ArrowRight" });
    await flushPromises();
    expect(selected(wrapper)).toContain("Situaties");
    expect(document.activeElement).toBe(tabs(wrapper)[1].element);
    expect(tabs(wrapper).map((t) => t.attributes("tabindex"))).toEqual(["-1", "0"]);
    await tabs(wrapper)[1].trigger("keydown", { key: "ArrowRight" }); // wraps around
    expect(selected(wrapper)).toContain("Onderwerpen");
    await tabs(wrapper)[0].trigger("keydown", { key: "End" });
    expect(selected(wrapper)).toContain("Situaties");
    await tabs(wrapper)[1].trigger("keydown", { key: "Home" });
    expect(selected(wrapper)).toContain("Onderwerpen");
    await tabs(wrapper)[0].trigger("keydown", { key: "ArrowLeft" });
    expect(selected(wrapper)).toContain("Situaties");
  });

  it("remembers the last tab on this device, and still works when storage is blocked", async () => {
    const first = await mountApp(TaalcafePicker);
    await tabs(first.wrapper)[1].trigger("click");
    first.wrapper.unmount();
    const again = await mountApp(TaalcafePicker);
    expect(selected(again.wrapper)).toContain("Situaties");
    again.wrapper.unmount();

    // Storage refused for the tab (private mode, blocked site data); the test helper's own key keeps working.
    const realGet = Storage.prototype.getItem;
    const realSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, k: string) {
      if (k === "taalcafeTab") throw new Error("blocked");
      return realGet.call(this, k);
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, k: string, v: string) {
      if (k === "taalcafeTab") throw new Error("blocked");
      return realSet.call(this, k, v);
    });
    const blocked = await mountApp(TaalcafePicker);
    expect(selected(blocked.wrapper)).toContain("Onderwerpen");
    await tabs(blocked.wrapper)[1].trigger("click");
    expect(selected(blocked.wrapper)).toContain("Situaties");
  });
});
