// @vitest-environment jsdom
// "Klaar voor vandaag": today's summary and saving the progress file for another device.
import { beforeEach, describe, expect, it, vi } from "vitest";
import FinishSessionDialog from "../../../src/components/FinishSessionDialog.vue";
import { useSessionStore } from "../../../src/stores/session";
import { buttonWith, clickButton, deferred, fakeApi, flushPromises, mountApp, pressKey } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

const lib = vi.hoisted(() => ({
  canShareFile: vi.fn(() => false),
  makeProgressFile: vi.fn((bundle: any, name: string) => ({ bundle, name }) as unknown as File),
  progressFileName: vi.fn((device: string | null) => `voortgang-${device ?? "apparaat"}.json`),
  saveProgressFile: vi.fn(async (_f: File): Promise<"shared" | "downloaded" | "cancelled"> => "downloaded"),
}));
vi.mock("../../../src/lib/progressFile", () => lib);

const summary = (extra: Record<string, unknown> = {}) => ({
  minutesToday: 25, answersToday: 40, correctToday: 30, unitsCompletedToday: 1, unsavedAnswers: 12, lastExportAt: null, deviceName: null, ...extra,
});
let current: ReturnType<typeof summary>;

beforeEach(() => {
  fakeApi.reset();
  vi.clearAllMocks();
  lib.canShareFile.mockReturnValue(false);
  lib.saveProgressFile.mockResolvedValue("downloaded");
  current = summary();
  fakeApi.on("GET", "/session/summary", () => current);
  fakeApi.on("GET", "/export", { version: 1 });
  fakeApi.on("POST", "/session/exported", {});
  fakeApi.on("PUT", "/device", {});
});

async function openDialog() {
  const m = await mountApp(FinishSessionDialog);
  useSessionStore(m.pinia).openFinish();
  await flushPromises();
  return m.wrapper;
}

describe("opening", () => {
  it("shows nothing until it is opened", async () => {
    const m = await mountApp(FinishSessionDialog);
    expect(m.wrapper.find("[role=dialog]").exists()).toBe(false);
    expect(fakeApi.calls).toHaveLength(0);
  });

  it("summarises today, with the share of right answers and the lessons finished", async () => {
    const w = await openDialog();
    expect(w.text()).toContain("25 minuten");
    expect(w.text()).toContain("40 antwoorden");
    expect(w.text()).toContain("(75% goed)");
    expect(w.text()).toContain("1 les klaar");
    expect(w.text()).toContain("12 nieuwe antwoorden zijn nog niet bewaard.");
    expect(w.text()).toContain("Je hebt je voortgang nog niet bewaard.");
  });

  it("a day without answers says so, and does not divide by zero", async () => {
    current = summary({ answersToday: 0, correctToday: 0, minutesToday: 0, unitsCompletedToday: 0, unsavedAnswers: 0 });
    const w = await openDialog();
    expect(w.text()).toContain("Je hebt vandaag nog niets gedaan");
    expect(w.text()).not.toContain("NaN");
  });

  it("uses the plural for several lessons", async () => {
    current = summary({ unitsCompletedToday: 3 });
    const w = await openDialog();
    expect(w.text()).toContain("3 lessen klaar");
  });

  it("Escape closes it, and opening it again starts clean", async () => {
    const m = await mountApp(FinishSessionDialog);
    const session = useSessionStore(m.pinia);
    session.openFinish();
    await flushPromises();
    await buttonWith(m.wrapper, "Bewaar voortgang")!.trigger("click");
    await flushPromises();
    expect(m.wrapper.find("[role=status]").exists()).toBe(true);
    await m.wrapper.find("[role=dialog]").trigger("keydown.esc");
    expect(session.finishOpen).toBe(false);
    session.openFinish();
    await flushPromises();
    expect(m.wrapper.find("[role=status]").exists()).toBe(false);
  });
});

describe("saving", () => {
  it("the save button waits until the file is ready", async () => {
    const pending = deferred();
    fakeApi.on("GET", "/export", () => pending.promise);
    const w = await openDialog();
    expect(w.text()).toContain("Even laden…");
    pending.resolve({ version: 1 });
    await flushPromises();
    expect(buttonWith(w, "Bewaar voortgang")!.attributes("disabled")).toBeUndefined();
  });

  it("saves the file, tells the app it was exported, and refreshes the 'not yet saved' count", async () => {
    const w = await openDialog();
    current = summary({ unsavedAnswers: 0, lastExportAt: "2026-03-01T10:00:00Z" });
    await clickButton(w, "Bewaar voortgang");
    expect(lib.saveProgressFile).toHaveBeenCalledTimes(1);
    expect(fakeApi.to("POST", "/session/exported")).toHaveLength(1);
    expect(w.find("[role=status]").text()).toContain("Bewaard in je downloads.");
    expect(w.text()).not.toContain("nog niet bewaard");
    expect(w.text()).toContain("Laatst bewaard:");
  });

  it("on a phone that can share, the button says so and the message is about sharing", async () => {
    lib.canShareFile.mockReturnValue(true);
    lib.saveProgressFile.mockResolvedValue("shared");
    const w = await openDialog();
    await clickButton(w, "Bewaar en deel");
    expect(w.find("[role=status]").text()).toContain("Bewaard! Open het bestand op je andere apparaat");
  });

  it("when the learner cancels the share sheet nothing is recorded and nothing is claimed", async () => {
    lib.saveProgressFile.mockResolvedValue("cancelled");
    const w = await openDialog();
    await clickButton(w, "Bewaar voortgang");
    expect(fakeApi.to("POST", "/session/exported")).toHaveLength(0);
    expect(w.find("[role=status]").exists()).toBe(false);
    expect(buttonWith(w, "Bewaar voortgang")!.attributes("disabled")).toBeUndefined();
  });

  it("a failure is shown and the learner can try again", async () => {
    lib.saveProgressFile.mockRejectedValueOnce(new Error("Opslaan niet toegestaan."));
    const w = await openDialog();
    await clickButton(w, "Bewaar voortgang");
    expect(w.find("[role=status]").text()).toContain("✗ Opslaan niet toegestaan.");
    expect(fakeApi.to("POST", "/session/exported")).toHaveLength(0);
    await clickButton(w, "Bewaar voortgang");
    expect(fakeApi.to("POST", "/session/exported")).toHaveLength(1);
  });

  it("a new device name is stored and goes into the file that is saved (not the old file)", async () => {
    current = summary({ deviceName: "Laptop" });
    const w = await openDialog();
    expect(lib.makeProgressFile).toHaveBeenLastCalledWith(expect.anything(), "voortgang-Laptop.json");
    await w.find("#device").setValue("Telefoon");
    current = summary({ deviceName: "Telefoon" });
    await clickButton(w, "Bewaar voortgang");
    expect(fakeApi.to("PUT", "/device")[0].body).toEqual({ name: "Telefoon" });
    expect(lib.makeProgressFile).toHaveBeenLastCalledWith(expect.anything(), "voortgang-Telefoon.json");
    expect((lib.saveProgressFile.mock.calls[0][0] as any).name).toBe("voortgang-Telefoon.json");
  });

  it("an unchanged device name does not touch the stored name or rebuild the file", async () => {
    current = summary({ deviceName: "Laptop" });
    const w = await openDialog();
    await clickButton(w, "Bewaar voortgang");
    expect(fakeApi.to("PUT", "/device")).toHaveLength(0);
    expect(lib.makeProgressFile).toHaveBeenCalledTimes(1);
  });
});
