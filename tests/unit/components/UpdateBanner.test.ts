// @vitest-environment jsdom
// "Er is een nieuwe versie": offering a downloaded new version of the app, and looking for one when the app comes back.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import UpdateBanner from "../../../src/components/UpdateBanner.vue";
import { updateReady, watchForUpdates } from "../../../src/lib/appUpdate";
import { buttonWith, clickButton, flushPromises, mountApp } from "../../helpers/component";

// The service worker side of vite-plugin-pwa: we play the browser that finds a new version.
const pwa = vi.hoisted(() => ({
  options: undefined as undefined | { onNeedRefresh?: () => void; onRegisteredSW?: (url: string, r: unknown) => void },
  activate: vi.fn(async (_reload?: boolean) => {}),
}));
vi.mock("virtual:pwa-register", () => ({
  registerSW: (options: typeof pwa.options) => {
    pwa.options = options;
    return pwa.activate;
  },
}));

const page = (name: string) => ({ template: `<p>${name}</p>` });
const routes = [
  { path: "/", component: page("dashboard") },
  { path: "/examen/:id", component: page("examen"), meta: { focus: true } },
];
const open = (url = "/") => mountApp(UpdateBanner, { routes, url });
const newVersionFound = async () => {
  pwa.options!.onNeedRefresh!();
  await flushPromises();
};
const setVisibility = (state: "visible" | "hidden") => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
  document.dispatchEvent(new Event("visibilitychange"));
};
const setOnline = (online: boolean) => Object.defineProperty(navigator, "onLine", { configurable: true, get: () => online });

let registration: { update: ReturnType<typeof vi.fn> };
beforeEach(() => {
  vi.clearAllMocks();
  updateReady.value = false;
  setOnline(true);
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
  watchForUpdates();
  registration = { update: vi.fn(async () => {}) };
  pwa.options!.onRegisteredSW!("/sw.js", registration);
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("offering the new version", () => {
  it("nothing is shown until a new version is ready; then 'Nu vernieuwen' switches to it with a reload", async () => {
    const { wrapper } = await open();
    expect(buttonWith(wrapper, "Nu vernieuwen")).toBeUndefined();
    await newVersionFound();
    expect(wrapper.text()).toContain("Er is een nieuwe versie van de app.");
    await clickButton(wrapper, "Nu vernieuwen");
    expect(pwa.activate).toHaveBeenCalledTimes(1);
    expect(pwa.activate).toHaveBeenCalledWith(true);
  });

  it("'Later' hides the offer without switching", async () => {
    const { wrapper } = await open();
    await newVersionFound();
    await clickButton(wrapper, "Later");
    expect(buttonWith(wrapper, "Nu vernieuwen")).toBeUndefined();
    expect(pwa.activate).not.toHaveBeenCalled();
  });

  it("is held back during an exam and shown once the learner leaves it", async () => {
    const { wrapper, router } = await open("/examen/1");
    await newVersionFound();
    expect(buttonWith(wrapper, "Nu vernieuwen")).toBeUndefined();
    await router.push("/");
    await flushPromises();
    expect(buttonWith(wrapper, "Nu vernieuwen")).toBeDefined();
  });
});

describe("looking for a new version", () => {
  it("each time the app comes back to the foreground (a phone resumes a tab without loading it)", () => {
    setVisibility("hidden");
    expect(registration.update).not.toHaveBeenCalled();
    setVisibility("visible");
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it("every hour while the app stays open", async () => {
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000 - 1);
    expect(registration.update).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it("not while offline", () => {
    setOnline(false);
    setVisibility("visible");
    expect(registration.update).not.toHaveBeenCalled();
  });
});
