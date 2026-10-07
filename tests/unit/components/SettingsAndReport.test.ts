// @vitest-environment jsdom
// Settings (API key, reset, flags), reporting a mistake, and importing a progress file.
import { beforeEach, describe, expect, it, vi } from "vitest";
import SettingsView from "../../../src/views/SettingsView.vue";
import ReportIssue from "../../../src/components/ReportIssue.vue";
import ImportSection from "../../../src/components/ImportSection.vue";
import { buttonWith, clickButton, fakeApi, flushPromises, mountApp, pressKey } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});
const readJsonFile = vi.hoisted(() => vi.fn());
vi.mock("../../../src/lib/progressFile", () => ({ readJsonFile, makeProgressFile: vi.fn(), progressFileName: vi.fn(), saveProgressFile: vi.fn(), canShareFile: vi.fn(() => false) }));

beforeEach(() => {
  fakeApi.reset();
  readJsonFile.mockReset();
});

describe("SettingsView", () => {
  let settings: Record<string, unknown>;
  beforeEach(() => {
    settings = { apiKey: null, model: "m1", dailyGoalMinutes: 20, newCardsPerDay: 10, speechRate: 0.95, spellcheckWriting: false, theme: "system", usage: { month: "2026-03", requests: 1, inputTokens: 1500, outputTokens: 200 } };
    fakeApi.on("GET", "/settings", () => settings);
    fakeApi.on("GET", "/flags", []);
    fakeApi.on("GET", "/import/last", null);
    fakeApi.on("GET", "/storage-status", {});
  });
  const open = () => mountApp(SettingsView, { routePath: "/instellingen", url: "/instellingen", stubs: { InstallHint: true, KeyGuide: true, ImportSection: true } });

  it("saving a key sends it, empties the box (the key is never left on screen), shows only the masked key, and tests it", async () => {
    fakeApi.on("POST", "/settings/api-key", () => (settings = { ...settings, apiKey: "sk-ant…wxyz" }));
    fakeApi.on("POST", "/settings/test-key", { ok: true, message: "De sleutel werkt." });
    const { wrapper } = await open();
    const input = wrapper.find("#apiKey");
    await input.setValue("sk-ant-geheim-1234567890");
    await clickButton(wrapper, "Opslaan en testen");
    expect(fakeApi.to("POST", "/settings/api-key")[0].body).toEqual({ apiKey: "sk-ant-geheim-1234567890" });
    expect((input.element as HTMLInputElement).value).toBe("");
    expect(wrapper.html()).not.toContain("sk-ant-geheim");
    expect(wrapper.text()).toContain("sk-ant…wxyz");
    expect(wrapper.text()).toContain("✓ De sleutel werkt.");
  });

  it("the key box is a password field and 'Opslaan' is disabled for an empty or blank key", async () => {
    const { wrapper } = await open();
    expect(wrapper.find("#apiKey").attributes("type")).toBe("password");
    expect(buttonWith(wrapper, "Opslaan en testen")!.attributes("disabled")).toBeDefined();
    await wrapper.find("#apiKey").setValue("   ");
    expect(buttonWith(wrapper, "Opslaan en testen")!.attributes("disabled")).toBeDefined();
  });

  it("an invalid key shows the reason and nothing is tested", async () => {
    fakeApi.fail("POST", "/settings/api-key", "Dit lijkt geen Anthropic-sleutel.");
    const { wrapper } = await open();
    await wrapper.find("#apiKey").setValue("onzin");
    await clickButton(wrapper, "Opslaan en testen");
    expect(wrapper.find("[role=alert]").text()).toContain("Dit lijkt geen Anthropic-sleutel.");
    expect(fakeApi.to("POST", "/settings/test-key")).toHaveLength(0);
  });

  it("removing the key asks for confirmation first", async () => {
    settings.apiKey = "sk-ant…wxyz";
    fakeApi.on("POST", "/settings/api-key/remove", () => (settings = { ...settings, apiKey: null }));
    const { wrapper } = await open();
    await clickButton(wrapper, "Sleutel verwijderen");
    expect(fakeApi.to("POST", "/settings/api-key/remove")).toHaveLength(0);
    await clickButton(wrapper, "Nee");
    expect(wrapper.text()).not.toContain("Ja, verwijderen");
    await clickButton(wrapper, "Sleutel verwijderen");
    await clickButton(wrapper, "Ja, verwijderen");
    expect(fakeApi.to("POST", "/settings/api-key/remove")).toHaveLength(1);
    expect(wrapper.text()).toContain("geen sleutel ingesteld");
  });

  it("the reset button stays disabled until RESET is typed exactly, then sends that confirmation", async () => {
    fakeApi.on("POST", "/progress/reset", {});
    const { wrapper } = await open();
    const reset = () => buttonWith(wrapper, "Wis mijn voortgang")!;
    for (const attempt of ["", "reset", "RESET ", "RESE"]) {
      await wrapper.find("#reset").setValue(attempt);
      expect(reset().attributes("disabled")).toBeDefined();
    }
    await wrapper.find("#reset").setValue("RESET");
    await reset().trigger("click");
    await flushPromises();
    expect(fakeApi.to("POST", "/progress/reset")[0].body).toEqual({ confirm: "RESET" });
    expect((wrapper.find("#reset").element as HTMLInputElement).value).toBe("");
    expect(wrapper.text()).toContain("Je voortgang is gewist.");
  });

  it("changing the theme or a number is saved as that setting only", async () => {
    fakeApi.on("PUT", "/settings", (body: any) => (settings = { ...settings, ...body }));
    const { wrapper } = await open();
    await clickButton(wrapper, "Donker");
    const minutes = wrapper.find("input[type=number]");
    (minutes.element as HTMLInputElement).value = "45";
    await minutes.trigger("change");
    await flushPromises();
    expect(fakeApi.to("PUT", "/settings").map((c) => c.body)).toEqual([{ theme: "dark" }, { dailyGoalMinutes: 45 }]);
    expect(wrapper.find("[role=status]").text()).toContain("Opgeslagen");
  });

  it("reported mistakes can be removed one by one", async () => {
    let flags = [{ id: "f1", title: "Vraag 1", note: "Twee goede antwoorden", at: "" }, { id: "f2", title: "Vraag 2", note: "", at: "" }];
    fakeApi.on("GET", "/flags", () => flags);
    fakeApi.on("POST", "/flags/f1/remove", () => (flags = flags.filter((f) => f.id !== "f1")));
    const { wrapper } = await open();
    expect(wrapper.text()).toContain("Mijn meldingen (2)");
    expect(wrapper.text()).toContain("(geen toelichting)");
    await wrapper.findAll("button").find((b) => b.text() === "Verwijder")!.trigger("click");
    await flushPromises();
    expect(wrapper.text()).toContain("Mijn meldingen (1)");
    expect(wrapper.text()).not.toContain("Twee goede antwoorden");
  });
});

describe("ReportIssue", () => {
  const open = () => mountApp(ReportIssue, { props: { itemId: "basis-a-q-003" } });
  const dialog = () => document.body.querySelector("[role=dialog]") as HTMLElement | null;

  it("sends the item and the note, confirms, and starts empty the next time", async () => {
    fakeApi.on("POST", "/flags", {});
    const { wrapper } = await open();
    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect(document.activeElement?.id).toBe("report-note"); // typing can start at once
    const note = document.body.querySelector("#report-note") as HTMLTextAreaElement;
    note.value = "Er zijn twee goede antwoorden.";
    note.dispatchEvent(new Event("input"));
    [...document.body.querySelectorAll("button")].find((b) => b.textContent?.includes("Verstuur melding"))!.click();
    await flushPromises();
    expect(fakeApi.to("POST", "/flags")[0].body).toEqual({ itemId: "basis-a-q-003", note: "Er zijn twee goede antwoorden." });
    expect(dialog()?.textContent).toContain("Bedankt! Je melding is bewaard.");

    [...document.body.querySelectorAll("button")].find((b) => b.textContent === "Sluiten")!.click();
    await flushPromises();
    expect(dialog()).toBeNull();
    expect(document.activeElement).toBe(wrapper.find("button").element); // focus goes back to where it was
    await wrapper.find("button").trigger("click");
    await flushPromises();
    expect((document.body.querySelector("#report-note") as HTMLTextAreaElement).value).toBe("");
  });

  it("a failing save shows the error and keeps the note", async () => {
    fakeApi.fail("POST", "/flags", "Opslaan mislukt.");
    const { wrapper } = await open();
    await wrapper.find("button").trigger("click");
    await flushPromises();
    [...document.body.querySelectorAll("button")].find((b) => b.textContent?.includes("Verstuur melding"))!.click();
    await flushPromises();
    expect(dialog()?.textContent).toContain("✗ Opslaan mislukt.");
    expect(dialog()?.textContent).not.toContain("Bedankt");
  });

  it("Escape closes without sending", async () => {
    const { wrapper } = await open();
    await wrapper.find("button").trigger("click");
    await flushPromises();
    dialog()!.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    await flushPromises();
    expect(dialog()).toBeNull();
    expect(fakeApi.to("POST", "/flags")).toHaveLength(0);
  });
});

describe("ImportSection", () => {
  const preview = (extra: Record<string, unknown> = {}) => ({
    from: { deviceName: "Telefoon", exportedAt: "2026-03-01T10:00:00Z", legacy: false },
    contentChanged: false, unknownItems: 0, settingsReplaced: false, lastLocationReplaced: false, nothingNew: false,
    counts: { attempts: { new: 5, updated: 0, total: 5 }, units: { new: 1, updated: 1, total: 2 }, srsCards: { new: 0, updated: 0, total: 9 } },
    ...extra,
  });
  const open = async (previewReply: unknown = preview()) => {
    fakeApi.on("GET", "/import/last", null);
    fakeApi.on("POST", "/import/preview", previewReply);
    const m = await mountApp(ImportSection);
    return m;
  };
  async function choose(w: any, name = "voortgang.json") {
    const input = w.find("input[type=file]");
    Object.defineProperty(input.element, "files", { value: [new File(["{}"], name)], configurable: true });
    await input.trigger("change");
    await flushPromises();
  }

  it("shows what a file would add, in plain words, and only lists what changes", async () => {
    readJsonFile.mockResolvedValue({ any: "file" });
    const { wrapper } = await open();
    await choose(wrapper);
    const text = wrapper.text();
    expect(fakeApi.to("POST", "/import/preview")[0].body).toEqual({ file: { any: "file" } });
    expect(text).toContain("van Telefoon");
    expect(text).toContain("5 antwoorden");
    expect(text).toContain("2 lessen");
    expect(text).toContain("(1 nieuw, 1 bijgewerkt)");
    expect(text).not.toContain("woordkaartjes"); // nothing changes there
    expect(text).toContain("Er wordt niets verwijderd.");
  });

  it("a file with nothing new says so and cannot be merged", async () => {
    readJsonFile.mockResolvedValue({});
    const { wrapper } = await open(preview({ nothingNew: true }));
    await choose(wrapper);
    expect(wrapper.text()).toContain("Hier staat niets nieuws in.");
    expect(buttonWith(wrapper, "Samenvoegen")!.attributes("disabled")).toBeDefined();
  });

  it("warns when the file comes from another version of the course", async () => {
    readJsonFile.mockResolvedValue({});
    const { wrapper } = await open(preview({ contentChanged: true, unknownItems: 3 }));
    await choose(wrapper);
    expect(wrapper.text()).toContain("andere versie van de cursus");
    expect(wrapper.text()).toContain("3 onderdelen bestaan hier niet meer");
  });

  it("a file that is not a progress file gives a clear message and no request", async () => {
    readJsonFile.mockRejectedValue(new Error("not json"));
    const { wrapper } = await open();
    await choose(wrapper);
    expect(wrapper.find("[role=alert]").text()).toContain("Dit bestand kan niet worden gelezen.");
    expect(fakeApi.to("POST", "/import/preview")).toHaveLength(0);
  });

  it("merging applies the same file, announces it and tells the parent to reload", async () => {
    readJsonFile.mockResolvedValue({ any: "file" });
    fakeApi.on("POST", "/import/apply", {});
    const { wrapper } = await open();
    await choose(wrapper);
    await clickButton(wrapper, "Samenvoegen");
    expect(fakeApi.to("POST", "/import/apply")[0].body).toEqual({ file: { any: "file" } });
    expect(wrapper.find("[role=status]").text()).toContain("Je voortgang is samengevoegd.");
    expect(wrapper.emitted("imported")).toHaveLength(1);
    expect(wrapper.text()).not.toContain("Dit wordt toegevoegd");
  });

  it("a rejected file shows the reason and is not merged", async () => {
    readJsonFile.mockResolvedValue({});
    const { wrapper } = await open();
    fakeApi.fail("POST", "/import/preview", "Dit bestand is niet van deze app.");
    await choose(wrapper);
    expect(wrapper.find("[role=alert]").text()).toContain("Dit bestand is niet van deze app.");
    expect(buttonWith(wrapper, "Samenvoegen")).toBeUndefined();
  });

  it("the last import can be undone", async () => {
    fakeApi.on("GET", "/import/last", { at: "2026-03-01T10:00:00Z", from: "Telefoon" });
    fakeApi.on("POST", "/import/preview", preview());
    fakeApi.on("POST", "/import/undo", {});
    const { wrapper } = await mountApp(ImportSection);
    expect(wrapper.text()).toContain("(van Telefoon)");
    await clickButton(wrapper, "Maak ongedaan");
    expect(fakeApi.to("POST", "/import/undo")).toHaveLength(1);
    expect(wrapper.text()).toContain("De laatste import is ongedaan gemaakt.");
    expect(wrapper.emitted("imported")).toHaveLength(1);
  });
});
