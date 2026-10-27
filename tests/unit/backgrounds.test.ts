// @vitest-environment jsdom
// Dashboard backgrounds: a different picture each visit, and the next one is downloaded before it is needed.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type Decode = () => Promise<void>;
class FakeImage {
  static all: FakeImage[] = [];
  static decode: () => Decode = () => () => Promise.resolve();
  src = "";
  decode: Decode;
  constructor() {
    this.decode = FakeImage.decode();
    FakeImage.all.push(this);
  }
}
const requested = () => FakeImage.all.map((i) => i.src);
const flush = () => new Promise((r) => setTimeout(r, 0));

/** A fresh copy of the module: its "next background" and "ready" state live at module level. */
async function load() {
  vi.resetModules();
  return import("../../src/lib/backgrounds");
}

beforeEach(() => {
  FakeImage.all = [];
  FakeImage.decode = () => () => Promise.resolve();
  vi.stubGlobal("Image", FakeImage);
  localStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("choosing", () => {
  it("there are several pictures to choose from", async () => {
    const { backgrounds } = await load();
    expect(backgrounds.length).toBeGreaterThan(2);
    expect(new Set(backgrounds).size).toBe(backgrounds.length);
  });

  it("never shows the same picture twice in a row", async () => {
    const { pickBackground } = await load();
    let previous = pickBackground();
    for (let i = 0; i < 60; i++) {
      const next = pickBackground();
      expect(next).not.toBe(previous);
      previous = next;
    }
  });

  it("after the app is closed and opened again, the first picture is not the one shown last time", async () => {
    const first = await load();
    first.primeBackground();
    const lastShown = first.pickBackground();
    const index = first.backgrounds.indexOf(lastShown);
    // the new session's random choice happens to land exactly on that same picture
    vi.spyOn(Math, "random").mockReturnValue(index / first.backgrounds.length + 0.0001);
    const second = await load();
    second.primeBackground();
    expect(second.pickBackground()).not.toBe(lastShown);
  });

  it("when the last picture is remembered and chance picks it again, another one is shown", async () => {
    const { backgrounds, primeBackground, pickBackground } = await load();
    localStorage.setItem("dashboardBackground", "3");
    vi.spyOn(Math, "random").mockReturnValue(3 / backgrounds.length + 0.0001); // lands exactly on index 3
    primeBackground();
    expect(pickBackground()).not.toBe(backgrounds[3]);
  });

  it("still works when the browser blocks storage", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { backgrounds, pickBackground } = await load();
    expect(backgrounds).toContain(pickBackground());
  });
});

describe("preloading", () => {
  it("starts downloading the first picture at app start, once", async () => {
    const { primeBackground } = await load();
    primeBackground();
    primeBackground();
    expect(FakeImage.all).toHaveLength(1);
  });

  it("the dashboard gets exactly the picture that was already downloading, and the following one starts downloading", async () => {
    const { primeBackground, pickBackground } = await load();
    primeBackground();
    const [starting] = requested();
    const shown = pickBackground();
    expect(shown).toBe(starting);
    expect(requested()).toHaveLength(2);
    expect(requested()[1]).not.toBe(shown);
    expect(pickBackground()).toBe(requested()[1]); // and that is what the next visit shows
  });

  it("the next time the app starts, it shows the picture downloaded during the last visit (it is cached by then)", async () => {
    const first = await load();
    first.primeBackground();
    first.pickBackground();
    const preloaded = requested()[1];
    FakeImage.all = [];
    const second = await load();
    second.primeBackground();
    expect(requested()).toEqual([preloaded]);
    expect(second.pickBackground()).toBe(preloaded);
  });

  it("a remembered picture from an older version of the site (other file name) is not used", async () => {
    localStorage.setItem("dashboardNextBackground", "/assets/bg1-oldhash.webp");
    const { backgrounds, primeBackground } = await load();
    primeBackground();
    expect(backgrounds).toContain(requested()[0]);
  });

  it("a remembered next picture that is the one shown last time is not used", async () => {
    const { backgrounds, primeBackground } = await load();
    localStorage.setItem("dashboardBackground", "2");
    localStorage.setItem("dashboardNextBackground", backgrounds[2]);
    primeBackground();
    expect(requested()[0]).not.toBe(backgrounds[2]);
  });

  it("without app-start priming it still picks and downloads", async () => {
    const { backgrounds, pickBackground } = await load();
    expect(backgrounds).toContain(pickBackground());
    expect(requested().length).toBeGreaterThanOrEqual(1);
  });

  it("a picture counts as ready only after it has been downloaded and decoded", async () => {
    const finishers: (() => void)[] = []; // one per image that starts downloading, in order
    FakeImage.decode = () => () => new Promise<void>((r) => finishers.push(r));
    const { primeBackground, pickBackground, isBackgroundReady } = await load();
    primeBackground();
    const url = requested()[0];
    expect(isBackgroundReady(url)).toBe(false);
    expect(pickBackground()).toBe(url);
    finishers[0]();
    await flush();
    expect(isBackgroundReady(url)).toBe(true);
    expect(isBackgroundReady(requested()[1])).toBe(false); // the next one is still downloading
  });

  it("a picture that fails to load is never ready, and nothing throws", async () => {
    FakeImage.decode = () => () => Promise.reject(new Error("broken image"));
    const { primeBackground, isBackgroundReady } = await load();
    primeBackground();
    await flush();
    expect(isBackgroundReady(requested()[0])).toBe(false);
  });

  it("a download that failed (e.g. offline) is tried again when the picture is needed", async () => {
    FakeImage.decode = () => () => Promise.reject(new Error("offline"));
    const { primeBackground, pickBackground } = await load();
    primeBackground();
    await flush();
    const url = requested()[0];
    expect(pickBackground()).toBe(url);
    expect(requested().filter((u) => u === url)).toHaveLength(2);
  });

  it("a picture that is ready is not downloaded again", async () => {
    const { primeBackground, pickBackground } = await load();
    primeBackground();
    await flush();
    const first = requested()[0];
    pickBackground(); // current = first (ready), queued = next
    await flush();
    pickBackground(); // current = next, queued = a third
    expect(requested().filter((u) => u === first)).toHaveLength(1);
  });

  it("works in a browser without Image.decode (older phones): the app starts, and a loaded picture is ready", async () => {
    FakeImage.decode = () => undefined as unknown as Decode;
    const { primeBackground, pickBackground, isBackgroundReady } = await load();
    expect(() => primeBackground()).not.toThrow();
    const url = requested()[0];
    expect(isBackgroundReady(url)).toBe(false);
    (FakeImage.all[0] as unknown as { onload: () => void }).onload();
    await flush();
    expect(isBackgroundReady(url)).toBe(true);
    expect(pickBackground()).toBe(url);
  });

  it("does not break where images cannot be created (no Image in the environment)", async () => {
    vi.stubGlobal("Image", undefined);
    const { backgrounds, primeBackground, pickBackground } = await load();
    expect(() => primeBackground()).not.toThrow();
    expect(backgrounds).toContain(pickBackground());
  });
});
