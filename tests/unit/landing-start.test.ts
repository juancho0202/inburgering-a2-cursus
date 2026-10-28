// @vitest-environment jsdom
// Landing page or app? public/boot.js decides before the first paint; src/lib/landing.ts starts the app.
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { hasLocalData, startApp } from "../../src/lib/landing";

const bootSource = readFileSync(path.resolve(__dirname, "../../public/boot.js"), "utf8");
const root = document.documentElement;

/** A page load at `url`: a fresh <html> class, then boot.js runs. */
function load(url: string) {
  history.replaceState(null, "", url);
  root.className = "";
  new Function(bootSource)();
}
const landingShown = () => !root.classList.contains("app");

beforeEach(() => localStorage.clear());
afterEach(() => vi.restoreAllMocks());

describe("boot.js", () => {
  it("a first visit to / shows the landing page", () => {
    load("/");
    expect(landingShown()).toBe(true);
  });

  it("a device that has started opens the app at /, so a bookmark goes straight in", () => {
    localStorage.setItem("appStarted", "1");
    load("/");
    expect(landingShown()).toBe(false);
  });

  it("any other page opens the app, even on a first visit", () => {
    for (const url of ["/oefenen", "/welkom", "/examen/exam-knm-1"]) {
      load(url);
      expect(landingShown(), url).toBe(false);
    }
  });

  it("/ with a query (such as ?lang=nl from a language page) opens the app", () => {
    load("/?lang=nl");
    expect(landingShown()).toBe(false);
  });

  it("blocked storage shows the landing page instead of failing", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    load("/");
    expect(landingShown()).toBe(true);
  });
});

describe("startApp", () => {
  it("on the landing page, a new visitor does not get the app (the URL stays /)", async () => {
    load("/");
    const mount = vi.fn();
    await startApp(mount, async () => false);
    expect(mount).not.toHaveBeenCalled();
    expect(landingShown()).toBe(true);
    load("/");
    expect(landingShown()).toBe(true);
  });

  it("opening the app anywhere (like the start link to /welkom) skips the landing page from then on", async () => {
    load("/welkom");
    const mount = vi.fn();
    await startApp(mount, async () => false);
    expect(mount).toHaveBeenCalledOnce();
    load("/");
    expect(landingShown()).toBe(false);
  });

  it("a learner from before the landing page existed goes straight into the app, now and next time", async () => {
    load("/");
    const mount = vi.fn();
    await startApp(mount, async () => true);
    expect(mount).toHaveBeenCalledOnce();
    expect(landingShown()).toBe(false);
    load("/");
    expect(landingShown()).toBe(false);
  });

  it("when the database check fails, the landing page stays", async () => {
    load("/");
    const mount = vi.fn();
    await startApp(mount, () => Promise.reject(new Error("no IndexedDB")));
    expect(mount).not.toHaveBeenCalled();
    expect(landingShown()).toBe(true);
  });
});

describe("hasLocalData", () => {
  const idb = (names: string[] | Error) =>
    ({ databases: () => (names instanceof Error ? Promise.reject(names) : Promise.resolve(names.map((name) => ({ name, version: 1 })))) }) as unknown as IDBFactory;

  it("a new visitor (no app database) does not need the app", async () => {
    expect(await hasLocalData(idb([]))).toBe(false);
    expect(await hasLocalData(idb(["some-other-site-db"]))).toBe(false);
  });

  it("a device with the app's database may be a returning learner", async () => {
    expect(await hasLocalData(idb(["inburgering-a2-secrets", "inburgering-a2"]))).toBe(true);
  });

  it("when the browser cannot list databases, it asks the app to be sure", async () => {
    expect(await hasLocalData({} as IDBFactory)).toBe(true);
    expect(await hasLocalData(idb(new Error("blocked")))).toBe(true);
  });

  it("without IndexedDB there is nothing to come back to", async () => {
    expect(await hasLocalData(undefined)).toBe(false);
  });
});
