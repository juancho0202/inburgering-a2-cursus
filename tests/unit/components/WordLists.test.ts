// @vitest-environment jsdom
// Woorden and Werkwoorden: searching, filtering, and starting practice.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VueWrapper } from "@vue/test-utils";
import VocabView from "../../../src/views/VocabView.vue";
import VerbsView from "../../../src/views/VerbsView.vue";
import { clickButton, fakeApi, mountApp } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

const word = (nl: string, article: "de" | "het", definitionNl: string, state: "new" | "learning" | "learned") => ({ id: `v-${nl}`, nl, article, definitionNl, example: `Een ${nl}.`, state });
const themes = () => [
  { theme: "wonen", title: "Wonen", entries: [word("de huur", "de", "geld voor je huis", "learned"), word("het huis", "het", "waar je woont", "learning"), word("de buur", "de", "iemand naast je", "new")] },
  { theme: "werk", title: "Werk", entries: [word("het salaris", "het", "geld voor je werk", "new")] },
];

beforeEach(() => fakeApi.reset());

describe("VocabView", () => {
  const open = () => {
    fakeApi.on("GET", "/vocab", themes());
    return mountApp(VocabView, { routePath: "/woorden", url: "/woorden" });
  };
  const shown = (w: VueWrapper) => w.findAll("article h3").map((h) => h.text());

  it("lists the words per theme with their learning state", async () => {
    const { wrapper } = await open();
    expect(wrapper.findAll("section h2").map((h) => h.text())).toEqual(["Wonen (3)", "Werk (1)"]);
    const huur = wrapper.findAll("article").find((a) => a.text().includes("de huur"))!;
    expect(huur.text()).toContain("Geleerd");
  });

  it("searches in the word and in its definition, ignoring case", async () => {
    const { wrapper } = await open();
    await wrapper.find("input[type=search]").setValue("HUIS");
    expect(shown(wrapper)).toEqual(["de huur", "het huis"]); // 'huis' in "het huis" and in the definition of "de huur"
    await wrapper.find("input[type=search]").setValue("  salaris ");
    expect(shown(wrapper)).toEqual(["het salaris"]);
  });

  it("filters by article and by state, and the filters combine", async () => {
    const { wrapper } = await open();
    const [article, state] = wrapper.findAll("select");
    await article.setValue("het");
    expect(shown(wrapper)).toEqual(["het huis", "het salaris"]);
    await state.setValue("open");
    expect(shown(wrapper)).toEqual(["het huis", "het salaris"]); // 'learning' counts as not yet learned
    await state.setValue("learned");
    expect(shown(wrapper)).toEqual([]);
    expect(wrapper.text()).toContain("Geen woorden gevonden.");
    await article.setValue("");
    expect(shown(wrapper)).toEqual(["de huur"]);
  });

  it("a theme without matching words disappears completely", async () => {
    const { wrapper } = await open();
    await wrapper.find("input[type=search]").setValue("salaris");
    expect(wrapper.findAll("section h2").map((h) => h.text())).toEqual(["Werk (1)"]);
  });

  it("'Leer dit thema' adds the cards, says how many, and reloads the list", async () => {
    fakeApi.on("POST", "/srs/introduce", { added: 3 });
    const { wrapper } = await open();
    await clickButton(wrapper, "Leer dit thema");
    expect(fakeApi.to("POST", "/srs/introduce")[0].body).toEqual({ theme: "wonen" });
    expect(wrapper.text()).toContain("3 nieuwe kaartjes klaar om te herhalen.");
    expect(fakeApi.to("GET", "/vocab")).toHaveLength(2);
  });

  it("learning a theme that is already being learned says so", async () => {
    fakeApi.on("POST", "/srs/introduce", { added: 0 });
    const { wrapper } = await open();
    await clickButton(wrapper, "Leer dit thema");
    expect(wrapper.text()).toContain("Je leert deze woorden al.");
  });
});

describe("VerbsView", () => {
  const verb = (infinitive: string, over: Record<string, unknown> = {}) => ({
    id: infinitive, infinitive, separable: false, irregular: false, auxiliary: "hebben", participle: `ge${infinitive}`,
    present: { ik: "a", jij: "b", hij: "c", wij: "d" }, past: { sg: "e", pl: "f" }, state: "new", ...over,
  });
  const open = () => {
    fakeApi.on("GET", "/verbs", [verb("werken"), verb("opbellen", { separable: true }), verb("gaan", { irregular: true, auxiliary: "zijn", participle: "gegaan" }), verb("vliegen", { irregular: true, auxiliary: "both", participle: "gevlogen" })]);
    return mountApp(VerbsView, { routePath: "/werkwoorden", url: "/werkwoorden" });
  };
  const shown = (w: VueWrapper) => w.findAll("tbody tr").map((r) => r.find("td").text().split(/\s/)[0]);

  it("shows the participle with the right auxiliary: heeft, is, or heeft/is", async () => {
    const { wrapper } = await open();
    const text = (name: string) => wrapper.findAll("tbody tr").find((r) => r.text().startsWith(name))!.text();
    expect(text("werken")).toContain("heeft gewerken");
    expect(text("gaan")).toContain("is gegaan");
    expect(text("vliegen")).toContain("heeft/is gevlogen");
  });

  it("searches the infinitive and combines with the separable / irregular filters", async () => {
    const { wrapper } = await open();
    await wrapper.find("input[type=search]").setValue(" GA");
    expect(shown(wrapper)).toEqual(["gaan"]);
    await wrapper.find("input[type=search]").setValue("");
    const [separable, irregular] = wrapper.findAll("input[type=checkbox]");
    await separable.setValue(true);
    expect(shown(wrapper)).toEqual(["opbellen"]);
    await separable.setValue(false);
    await irregular.setValue(true);
    expect(shown(wrapper)).toEqual(["gaan", "vliegen"]);
  });

  it("'Oefen werkwoorden' adds the verb cards first, then opens the review with only verbs", async () => {
    fakeApi.on("POST", "/srs/introduce", { added: 4 });
    const { wrapper, router } = await open();
    await clickButton(wrapper, "Oefen werkwoorden");
    expect(fakeApi.to("POST", "/srs/introduce")[0].body).toEqual({ verbs: true });
    expect(router.currentRoute.value.fullPath).toBe("/woorden/herhalen?kind=verb");
  });
});
