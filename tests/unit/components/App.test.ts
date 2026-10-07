// @vitest-environment jsdom
// The app shell: navigation menu, focus mode during exams, theme.
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "../../../src/App.vue";
import { useSessionStore } from "../../../src/stores/session";
import { fakeApi, flushPromises, mountApp, pressKey } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

const page = (name: string) => ({ template: `<p>${name}</p>` });
const routes = [
  { path: "/", component: page("dashboard") },
  { path: "/woorden", component: page("woorden") },
  { path: "/woorden/herhalen", component: page("herhalen") },
  { path: "/werkwoorden", component: page("werkwoorden") },
  { path: "/examen/:id", component: page("examen"), meta: { focus: true } },
];

let osDark = false;
const mediaListeners = new Set<() => void>();
let theme: string | undefined;

beforeEach(() => {
  fakeApi.reset();
  theme = "system";
  fakeApi.on("GET", "/settings", () => ({ apiKey: null, theme }));
  osDark = false;
  mediaListeners.clear();
  window.matchMedia = ((q: string) => ({
    matches: osDark && q.includes("dark"),
    addEventListener: (_: string, fn: () => void) => mediaListeners.add(fn),
    removeEventListener: (_: string, fn: () => void) => mediaListeners.delete(fn),
  })) as any;
  document.documentElement.classList.remove("dark");
  document.body.style.overflow = "";
});
// the finish dialog has its own tests
const open = (url = "/") => mountApp(App, { routes, url, stubs: { FinishSessionDialog: true } });
const menuButton = (w: any) => w.find("button[aria-label='Menu openen']");

describe("mobile menu", () => {
  it("opens with focus on the close button, locks page scrolling, and closes with Escape giving focus back", async () => {
    const { wrapper } = await open();
    await menuButton(wrapper).trigger("click");
    await flushPromises();
    expect(wrapper.find("#mobile-menu").exists()).toBe(true);
    expect(menuButton(wrapper).attributes("aria-expanded")).toBe("true");
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Menu sluiten");
    expect(document.body.style.overflow).toBe("hidden");

    await pressKey("Escape");
    expect(wrapper.find("#mobile-menu").exists()).toBe(false);
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(menuButton(wrapper).element);
  });

  it("choosing a page closes the menu and shows that page", async () => {
    const { wrapper, router } = await open();
    await menuButton(wrapper).trigger("click");
    await flushPromises();
    await wrapper.find("#mobile-menu a[href='/woorden']").trigger("click");
    await flushPromises();
    expect(router.currentRoute.value.path).toBe("/woorden");
    expect(wrapper.find("#mobile-menu").exists()).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });

  it("tapping outside the panel closes it", async () => {
    const { wrapper } = await open();
    await menuButton(wrapper).trigger("click");
    await flushPromises();
    await wrapper.find(".drawer-overlay").trigger("click");
    expect(wrapper.find("#mobile-menu").exists()).toBe(false);
  });

  it("'Klaar voor vandaag' in the menu closes the menu and opens the finish dialog", async () => {
    const { wrapper, pinia } = await open();
    await menuButton(wrapper).trigger("click");
    await flushPromises();
    const finish = wrapper.findAll("#mobile-menu button").find((b) => b.text().includes("Klaar voor vandaag"))!;
    await finish.trigger("click");
    expect(wrapper.find("#mobile-menu").exists()).toBe(false);
    expect(useSessionStore(pinia).finishOpen).toBe(true);
  });

  it("leaving the app releases the scroll lock", async () => {
    const { wrapper } = await open();
    await menuButton(wrapper).trigger("click");
    await flushPromises();
    wrapper.unmount();
    expect(document.body.style.overflow).toBe("");
  });
});

describe("which link is highlighted", () => {
  const current = (w: any) => w.findAll("header nav a[aria-current='page']").map((a: any) => a.text());

  it("'Leren' only on the home page", async () => {
    const { wrapper } = await open("/");
    expect(current(wrapper)).toEqual(["🏠Leren"]);
    const other = await open("/woorden");
    expect(current(other.wrapper)).toEqual(["🔤Woorden"]);
  });

  it("a sub page keeps its parent highlighted; similar names do not mix up (Woorden vs Werkwoorden)", async () => {
    const sub = await open("/woorden/herhalen");
    expect(current(sub.wrapper)).toEqual(["🔤Woorden"]);
    const verbs = await open("/werkwoorden");
    expect(current(verbs.wrapper)).toEqual(["🔁Werkwoorden"]);
  });
});

describe("during an exam", () => {
  it("the menu, the footer and the 'finish' button are out of the way", async () => {
    const { wrapper } = await open("/examen/ex1");
    expect(wrapper.find("header").exists()).toBe(false);
    expect(wrapper.find("footer").exists()).toBe(false);
    expect(wrapper.text()).toContain("examen");
  });

  it("an open menu does not stay on top of an exam that is opened from it", async () => {
    const { wrapper, router } = await open("/");
    await menuButton(wrapper).trigger("click");
    await flushPromises();
    await router.push("/examen/ex1");
    await flushPromises();
    expect(wrapper.find("#mobile-menu").exists()).toBe(false);
  });
});

describe("theme", () => {
  it("'dark' and 'light' are applied as chosen", async () => {
    theme = "dark";
    await open();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    theme = "light";
    osDark = true;
    await open();
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("'system' follows the device, also when the device switches while the app is open", async () => {
    osDark = true;
    await open();
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    osDark = false;
    mediaListeners.forEach((fn) => fn());
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("stops listening to the device when the app is removed", async () => {
    const { wrapper } = await open();
    expect(mediaListeners.size).toBe(1);
    wrapper.unmount();
    expect(mediaListeners.size).toBe(0);
  });
});
