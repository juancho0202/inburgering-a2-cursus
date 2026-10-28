// @vitest-environment jsdom
// Progress indicators and the summary page: values outside 0–100% must not break the picture.
import { beforeEach, describe, expect, it, vi } from "vitest";
import GoalGauge from "../../../src/components/ui/GoalGauge.vue";
import ProgressBar from "../../../src/components/ui/ProgressBar.vue";
import ProgressRing from "../../../src/components/ui/ProgressRing.vue";
import SamenvattingView from "../../../src/views/SamenvattingView.vue";
import { fakeApi, mountApp } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

beforeEach(() => fakeApi.reset());

describe("ProgressBar", () => {
  const fill = (v: number) => mountApp(ProgressBar, { props: { value: v, label: "Voortgang" } }).then((m) => m.wrapper.find("[role=progressbar] > div").attributes("style"));

  it("fills in proportion to the value", async () => {
    expect(await fill(0.25)).toContain("width: 25%");
  });

  it("never draws outside the bar: 130% shows as full, a negative value as empty", async () => {
    expect(await fill(1.3)).toContain("width: 100%");
    expect(await fill(-0.2)).toContain("width: 0%");
  });

  it("tells screen readers the value and what it is about", async () => {
    const { wrapper } = await mountApp(ProgressBar, { props: { value: 0.666, label: "Voortgang Basis" } });
    const bar = wrapper.find("[role=progressbar]");
    expect(bar.attributes("aria-valuenow")).toBe("67");
    expect(bar.attributes("aria-label")).toBe("Voortgang Basis");
  });
});

describe("ProgressRing (daily goal)", () => {
  const offsetOf = async (v: number) => {
    const { wrapper } = await mountApp(ProgressRing, { props: { value: v } });
    const circle = wrapper.findAll("circle")[1];
    return { offset: Number(circle.attributes("stroke-dashoffset")), full: Number(circle.attributes("stroke-dasharray")) };
  };

  it("shows how much of the goal is done", async () => {
    const { offset, full } = await offsetOf(0.5);
    expect(offset).toBeCloseTo(full / 2);
  });

  it("a goal that is exceeded shows a full ring, not a ring that wraps around", async () => {
    expect((await offsetOf(2.5)).offset).toBe(0);
  });

  it("no progress yet is an empty ring", async () => {
    const { offset, full } = await offsetOf(0);
    expect(offset).toBeCloseTo(full);
  });
});

describe("GoalGauge (daily goal)", () => {
  const gauge = (minutes: number, goal = 30) => mountApp(GoalGauge, { props: { minutes, goal } }).then((m) => m.wrapper);
  const needle = (w: Awaited<ReturnType<typeof gauge>>) => {
    const l = w.find("line");
    return { x: Number(l.attributes("x2")), y: Number(l.attributes("y2")) };
  };

  it("shows the minutes done, with 0 and the goal at the ends of the scale", async () => {
    const w = await gauge(7.6);
    expect(w.findAll("text").map((t) => t.text())).toEqual(["8", "0", "30"]);
    expect(w.find("svg").attributes("aria-label")).toBe("8 van 30 minuten");
  });

  it("halfway to the goal the needle points straight up", async () => {
    const { x, y } = needle(await gauge(15));
    expect(x).toBeCloseTo(50);
    expect(y).toBeCloseTo(20);
  });

  it("past the goal the number keeps counting but the needle stays at the end of the scale", async () => {
    const over = await gauge(45);
    expect(over.findAll("text")[0].text()).toBe("45");
    expect(needle(over)).toEqual(needle(await gauge(30)));
    expect(needle(await gauge(30)).y).toBeGreaterThan(needle(await gauge(29)).y); // still moving just before the goal
  });

  it("no minutes yet: the needle rests at 0, not below it", async () => {
    expect(needle(await gauge(0))).toEqual(needle(await gauge(-3)));
    expect(needle(await gauge(0)).x).toBeLessThan(50);
    expect((await gauge(0)).findAll("path")).toHaveLength(1); // only the grey scale, no orange dot
  });
});

describe("SamenvattingView", () => {
  it("builds a table of contents from the second-level headings, each pointing at its heading", async () => {
    fakeApi.on("GET", "/samenvatting", { md: "# Titel\n\n## Wonen en huur\n\ntekst\n\n## Gezondheid & zorg\n\nmeer tekst\n\n### Onderdeel" });
    const { wrapper } = await mountApp(SamenvattingView, { routePath: "/samenvatting", url: "/samenvatting" });
    const links = wrapper.findAll("nav a");
    expect(links.map((a) => a.text())).toEqual(["Wonen en huur", "Gezondheid & zorg"]);
    const ids = wrapper.findAll("article h2").map((h) => h.attributes("id"));
    expect(links.map((a) => a.attributes("href"))).toEqual(ids.map((id) => `#${id}`));
    expect(ids).toEqual(["wonen-en-huur", "gezondheid-zorg"]);
  });

  it("shows HTML typed into the text as text", async () => {
    fakeApi.on("GET", "/samenvatting", { md: "## Kop\n\n<img src=x onerror=\"window.__pwned2=1\">" });
    const { wrapper } = await mountApp(SamenvattingView, { routePath: "/samenvatting", url: "/samenvatting" });
    expect(wrapper.find("article img").exists()).toBe(false);
    expect((window as any).__pwned2).toBeUndefined();
  });

  it("shows the error when the summary cannot be loaded", async () => {
    fakeApi.fail("GET", "/samenvatting", "Samenvatting niet gevonden.");
    const { wrapper } = await mountApp(SamenvattingView, { routePath: "/samenvatting", url: "/samenvatting" });
    expect(wrapper.text()).toContain("Samenvatting niet gevonden.");
  });
});
