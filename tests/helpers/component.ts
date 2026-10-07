// Shared helpers for component tests (see tests/README.md).
import { afterEach, vi } from "vitest";
import { enableAutoUnmount, flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia, setActivePinia } from "pinia";
import { createMemoryHistory, createRouter, type RouteRecordRaw } from "vue-router";
import type { Component } from "vue";

// Unmount after every test, so window key listeners of earlier tests never leak into later ones.
enableAutoUnmount(afterEach);

/** Same shape as the real error, so components that check `instanceof ApiRequestError` behave the same. */
export class ApiRequestError extends Error {
  constructor(
    message: string,
    public code: string,
    public body: Record<string, unknown>,
  ) {
    super(message);
  }
}

type Method = "GET" | "POST" | "PUT";
type Reply = unknown | ((body: unknown, path: string) => unknown);
export interface Call {
  method: Method;
  path: string;
  body: unknown;
}

/**
 * Stand-in for src/api/client. Every endpoint a test needs is registered with `on`; any call that is not
 * registered rejects with "Unexpected API call", so a component cannot quietly talk to an endpoint the
 * test did not think about. The newest registration for a path wins, so a test can override a default.
 */
class FakeApi {
  calls: Call[] = [];
  private routes: { method: Method; match: string | RegExp; reply: Reply }[] = [];

  on(method: Method, match: string | RegExp, reply: Reply = {}) {
    this.routes.unshift({ method, match, reply });
    return this;
  }
  /** Fails the request the way the real client does (status >= 400). */
  fail(method: Method, match: string | RegExp, message: string, body: Record<string, unknown> = {}) {
    return this.on(method, match, () => {
      throw new ApiRequestError(message, "error", body);
    });
  }
  reset() {
    this.calls = [];
    this.routes = [];
  }
  /** Calls made to an endpoint, in order. */
  to(method: Method, match: string | RegExp): Call[] {
    return this.calls.filter((c) => c.method === method && (typeof match === "string" ? c.path === match : match.test(c.path)));
  }

  private async request(method: Method, path: string, body?: unknown) {
    this.calls.push({ method, path, body });
    const route = this.routes.find((r) => r.method === method && (typeof r.match === "string" ? r.match === path : r.match.test(path)));
    if (!route) throw new Error(`Unexpected API call: ${method} ${path}`);
    return typeof route.reply === "function" ? (route.reply as (b: unknown, p: string) => unknown)(body, path) : route.reply;
  }
  api = {
    get: (path: string) => this.request("GET", path),
    post: (path: string, body?: unknown) => this.request("POST", path, body),
    put: (path: string, body?: unknown) => this.request("PUT", path, body),
  };
}
export const fakeApi = new FakeApi();

/** A promise you resolve yourself, to hold an API call open and test what happens in the meantime. */
export function deferred<T = unknown>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
}

interface MountOptions {
  props?: Record<string, unknown>;
  /** Initial URL, e.g. "/unit/a" (default "/"). */
  url?: string;
  /** Route the component is mounted on; other paths render an empty page. */
  routePath?: string;
  stubs?: Record<string, Component | boolean>;
  /** Replaces the routes (for tests of the app shell, which needs route meta and several pages). */
  routes?: RouteRecordRaw[];
}

/**
 * Mounts a component with a real pinia and a real router (memory history), like the app does.
 * When `routePath` is given the component is rendered through <RouterView/>, so route changes behave
 * like in the app (including the router reusing the component when only a param changes).
 * It is attached to the document, so key presses and focus work like in a browser.
 */
export async function mountApp(component: Component, opts: MountOptions = {}) {
  const pinia = createPinia();
  setActivePinia(pinia);
  const empty = { template: "<i />" };
  const router = createRouter({
    history: createMemoryHistory(),
    routes: opts.routes ?? [...(opts.routePath ? [{ path: opts.routePath, component }] : []), { path: "/:rest(.*)*", component: empty }],
  });
  router.push(opts.url ?? "/");
  await router.isReady();
  const root = opts.routePath ? ({ template: "<RouterView />" } as Component) : component;
  const wrapper = mount(root, { props: opts.routePath ? undefined : opts.props, attachTo: document.body, global: { plugins: [pinia, router], stubs: opts.stubs } });
  await flushPromises();
  return { wrapper, router, pinia };
}

export const buttonWith = (w: VueWrapper, text: string) => w.findAll("button").find((b) => b.text().includes(text));

/** Click the button that contains `text`; throws when there is none, so a renamed button fails loudly. */
export async function clickButton(w: VueWrapper, text: string) {
  const b = buttonWith(w, text);
  if (!b) throw new Error(`No button with text "${text}". Buttons: ${w.findAll("button").map((x) => x.text()).join(" | ")}`);
  await b.trigger("click");
  await flushPromises();
}

export async function pressKey(key: string, target: EventTarget = window) {
  target.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }));
  await flushPromises();
}

export { flushPromises };
export const resetMocks = () => {
  fakeApi.reset();
  vi.restoreAllMocks();
};
