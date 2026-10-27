// @vitest-environment jsdom
// Lesson content (blocks and documents) and the small list pages.
import { beforeEach, describe, expect, it, vi } from "vitest";
import LessonBlocks from "../../../src/components/LessonBlocks.vue";
import DocumentCard from "../../../src/components/DocumentCard.vue";
import ExamsView from "../../../src/views/ExamsView.vue";
import WritingHistoryView from "../../../src/views/WritingHistoryView.vue";
import WelcomeView from "../../../src/views/WelcomeView.vue";
import { clickButton, fakeApi, mountApp } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

beforeEach(() => fakeApi.reset());

describe("LessonBlocks", () => {
  it("shows lesson text as formatted text, but never runs HTML written in it", async () => {
    const { wrapper } = await mountApp(LessonBlocks, {
      props: { blocks: [{ kind: "text", md: "Dit is **belangrijk** <img src=x onerror=\"window.__pwned=1\"> en <script>window.__pwned=1</script>" }] },
    });
    expect(wrapper.find("strong").text()).toBe("belangrijk");
    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.find("script").exists()).toBe(false);
    expect(wrapper.text()).toContain("<script>");
    expect((window as any).__pwned).toBeUndefined();
  });

  it("loads the vocabulary only when a block needs it, and shows the words by id", async () => {
    fakeApi.on("GET", "/vocab", [{ theme: "t", title: "T", entries: [{ id: "v1", nl: "de huur", definitionNl: "geld voor je huis", example: "Ik betaal de huur.", article: "de", state: "new" }] }]);
    const none = await mountApp(LessonBlocks, { props: { blocks: [{ kind: "tip", md: "Let op" }] } });
    expect(fakeApi.to("GET", "/vocab")).toHaveLength(0);
    const { wrapper } = await mountApp(LessonBlocks, { props: { blocks: [{ kind: "vocab", ids: ["v1", "v-onbekend"] }] } });
    expect(fakeApi.to("GET", "/vocab")).toHaveLength(1);
    expect(wrapper.text()).toContain("de huur");
    expect(wrapper.text()).toContain("Ik betaal de huur.");
    expect(wrapper.text()).toContain("…"); // an unknown id shows a placeholder, not a crash
    expect(none.wrapper.text()).toContain("Let op");
  });

  it("dialogue lines alternate between the left and the right", async () => {
    const { wrapper } = await mountApp(LessonBlocks, {
      props: { blocks: [{ kind: "dialogue", lines: [{ speaker: "Anna", nl: "Hoi!" }, { speaker: "Piet", nl: "Dag!" }, { speaker: "Anna", nl: "Hoe gaat het?" }] }] },
    });
    const rows = wrapper.findAll(".grid.gap-2 > div");
    expect(rows.map((r) => r.classes().includes("justify-end"))).toEqual([false, true, false]);
  });

  it("tables show their headers and rows", async () => {
    const { wrapper } = await mountApp(LessonBlocks, { props: { blocks: [{ kind: "table", headers: ["ik", "jij"], rows: [["werk", "werkt"], ["loop", "loopt"]] }] } });
    expect(wrapper.findAll("th").map((h) => h.text())).toEqual(["ik", "jij"]);
    expect(wrapper.findAll("tbody tr").map((r) => r.text())).toEqual(["werkwerkt", "looploopt"]);
  });
});

describe("DocumentCard", () => {
  const doc = (body: string, docType = "brief") => ({ kind: "document", docType, title: "Titel", body });

  it("turns 'Van:', 'Aan:'… lines at the top into a header, and leaves the rest as the letter", async () => {
    const { wrapper } = await mountApp(DocumentCard, { props: { doc: doc("Van: Gemeente\nAan: Jan\nOnderwerp: Afspraak\n\nBeste Jan,\nUw afspraak is op maandag.") } });
    const text = wrapper.text();
    expect(text).toContain("Gemeente");
    expect(text).toContain("Afspraak");
    expect(text).toContain("Beste Jan,");
    expect(text).toContain("Brief");
  });

  it("a header word later in the text is not pulled into the header", async () => {
    const { wrapper } = await mountApp(DocumentCard, { props: { doc: doc("Beste Jan,\nVan: dit is gewoon een zin") } });
    expect(wrapper.text()).toContain("Van: dit is gewoon een zin");
  });

  it("only the known header words start the header: other 'something:' lines are part of the text", async () => {
    const { wrapper } = await mountApp(DocumentCard, { props: { doc: doc("Opmerking: kom op tijd\nVan: Gemeente\nBeste Jan,") } });
    expect(wrapper.text()).toContain("Opmerking: kom op tijd");
    expect(wrapper.find("dl").exists()).toBe(false); // nothing was turned into a header block
  });

  it("lines with ' | ' become a table, grouped per block of lines", async () => {
    const { wrapper } = await mountApp(DocumentCard, { props: { doc: doc("Rooster voor week 3\nmaandag | 9:00 | Les\ndinsdag | 10:00 | Pauze\nTot ziens!", "rooster") } });
    expect(wrapper.findAll("tr").map((r) => r.text())).toEqual(["maandag9:00Les", "dinsdag10:00Pauze"]);
    expect(wrapper.text()).toContain("Rooster voor week 3");
    expect(wrapper.text()).toContain("Tot ziens!");
  });
});

describe("ExamsView", () => {
  const row = (extra: Record<string, unknown>) => ({ id: "e1", skill: "knm", title: "KNM 1", durationMinutes: 30, passScore: 0.7, questionCount: 40, inProgress: null, attempts: [], ...extra });
  const open = (rows: unknown[]) => {
    fakeApi.on("GET", "/exams", rows);
    return mountApp(ExamsView, { routePath: "/examens", url: "/examens" });
  };

  it("groups the exams by skill and uses 'opdrachten' for writing and 'vragen' for the rest", async () => {
    const { wrapper } = await open([row({}), row({ id: "e2", skill: "schrijven", title: "Schrijven 1", questionCount: 3 })]);
    expect(wrapper.findAll("section h2").map((h) => h.text())).toEqual(["🏛️ KNM", "✍️ Schrijven A2"]);
    expect(wrapper.text()).toContain("30 minuten · 40 vragen");
    expect(wrapper.text()).toContain("30 minuten · 3 opdrachten");
  });

  it("the button says what will happen: start, redo, or continue (and the clock keeps running)", async () => {
    const attempt = { id: "r1", finishedAt: "2026-03-01T10:00:00Z", score: 30, max: 40 };
    const { wrapper } = await open([
      row({ id: "new" }),
      row({ id: "done", attempts: [attempt] }),
      row({ id: "busy", inProgress: { id: "r2", startedAt: "2026-03-01T10:00:00Z" } }),
    ]);
    const buttons = wrapper.findAll("article").map((a) => a.find("button").text());
    expect(buttons).toEqual(["Start het examen", "Opnieuw maken", "Verder met het examen"]);
    expect(wrapper.text()).toContain("Je bent bezig. De tijd loopt door.");
  });

  it("shows only the three latest results, newest first, each linking to its result page", async () => {
    const at = (n: number) => ({ id: `r${n}`, finishedAt: `2026-03-0${n}T10:00:00Z`, score: n * 5, max: 40 });
    const { wrapper } = await open([row({ attempts: [at(1), at(2), at(3), at(4)] })]);
    const links = wrapper.findAll("article li a");
    expect(links.map((a) => a.attributes("href"))).toEqual(["/examen/e1/resultaat/r4", "/examen/e1/resultaat/r3", "/examen/e1/resultaat/r2"]);
    expect(links[0].text()).toContain("20 / 40 (50%)");
  });
});

describe("WritingHistoryView", () => {
  const fb = { overall: "voldoende", score: 8, criteria: [], missingPoints: [], corrections: [], correctedText: "x", strongPoints: [], nextTip: "t" };
  const row = (id: string, type: string | null, feedback: unknown = null) => ({
    id, exerciseId: `ex-${id}`, text: `tekst ${id}`, submittedAt: "2026-03-01T10:00:00Z", feedback,
    task: type ? { prompt: `Opdracht ${id}`, scenario: "", register: "informal", type } : null,
  });
  const open = (rows: unknown[]) => {
    fakeApi.on("GET", "/writing", rows);
    return mountApp(WritingHistoryView, { routePath: "/schrijven/geschiedenis", url: "/schrijven/geschiedenis" });
  };

  it("filters by kind of task; texts of an exercise that no longer exists count as 'overig'", async () => {
    const { wrapper } = await open([row("a", "kort-bericht"), row("b", "formeel"), row("c", null)]);
    const shown = () => wrapper.findAll("ul > li").map((li) => li.text());
    expect(shown()).toHaveLength(3);
    await wrapper.find("select").setValue("overig");
    expect(shown()).toHaveLength(1);
    expect(shown()[0]).toContain("ex-c");
    await wrapper.find("select").setValue("formeel");
    expect(shown()[0]).toContain("Opdracht b");
  });

  it("opens one text at a time, with feedback when there is some and the plain text when not", async () => {
    const { wrapper } = await open([row("a", "kort-bericht", fb), row("b", "kort-bericht")]);
    const toggles = wrapper.findAll("li > button");
    expect(toggles[0].text()).toContain("voldoende · 8/10");
    expect(toggles[1].text()).toContain("geen feedback");
    await toggles[0].trigger("click");
    expect(wrapper.text()).toContain("Voldoende");
    await toggles[1].trigger("click");
    expect(toggles[0].attributes("aria-expanded")).toBe("false");
    expect(toggles[1].attributes("aria-expanded")).toBe("true");
    expect(wrapper.text()).toContain("Jouw tekst");
    expect(wrapper.text()).toContain("tekst b");
  });

  it("no texts yet gives a hint, not an empty page", async () => {
    const { wrapper } = await open([]);
    expect(wrapper.text()).toContain("Nog geen teksten.");
  });
});

describe("WelcomeView", () => {
  it("'start' marks the welcome as seen and goes to the start page", async () => {
    fakeApi.on("POST", "/welcome/seen", {});
    fakeApi.on("GET", "/import/last", null);
    const { wrapper, router } = await mountApp(WelcomeView, { routePath: "/welkom", url: "/welkom", stubs: { ImportSection: true, AboutContent: true } });
    const start = wrapper.findAll("button").find((b) => /start|begin|beginnen/i.test(b.text()));
    expect(start, wrapper.findAll("button").map((b) => b.text()).join(" | ")).toBeDefined();
    await start!.trigger("click");
    await new Promise((r) => setTimeout(r, 0));
    expect(fakeApi.to("POST", "/welcome/seen")).toHaveLength(1);
    expect(router.currentRoute.value.path).toBe("/");
  });
});
