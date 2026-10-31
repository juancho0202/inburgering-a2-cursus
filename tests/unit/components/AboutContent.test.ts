// @vitest-environment jsdom
// The "about" text: the maker's credit links to their GitHub profile, in every app language, and browser
// translators leave the name and the username alone.
import { beforeEach, describe, expect, it, vi } from "vitest";
import AboutContent from "../../../src/components/AboutContent.vue";
import { fakeApi, mountApp } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

beforeEach(() => fakeApi.reset());

describe("AboutContent credit", () => {
  for (const [language, heading, madeBy] of [
    ["en", "Who made this?", "Made by"],
    ["nl", "Wie heeft dit gemaakt?", "Gemaakt door"],
    ["es", "¿Quién hizo esto?", "Hecho por"],
  ] as const) {
    it(`names the maker and links to their GitHub profile (${language})`, async () => {
      const { wrapper } = await mountApp(AboutContent, { language, stubs: { KeyGuide: true } });
      const section = wrapper.findAll("section").find((s) => s.find("h2").text().includes(heading));
      expect(section, wrapper.findAll("h2").map((h) => h.text()).join(" | ")).toBeDefined();
      expect(section!.text()).toContain(`${madeBy} Juan David Muñoz`);
      const link = section!.findAll("a").find((a) => a.text() === "github.com/juancho0202");
      expect(link?.attributes("href")).toBe("https://github.com/juancho0202");
    });
  }

  it("keeps browser translators off the name and the username", async () => {
    const { wrapper } = await mountApp(AboutContent, { language: "en", stubs: { KeyGuide: true } });
    const name = wrapper.findAll("strong").find((s) => s.text() === "Juan David Muñoz");
    const link = wrapper.findAll("a").find((a) => a.text() === "github.com/juancho0202");
    expect(name?.attributes("translate")).toBe("no");
    expect(link?.attributes("translate")).toBe("no");
  });
});

describe("AboutContent maker", () => {
  for (const [language, heading, alt, claude] of [
    ["en", "Who made this?", "A drawing of Juan David with a cup of coffee", "Built with a lot of help from Claude Opus 5.5"],
    ["nl", "Wie heeft dit gemaakt?", "Een tekening van Juan David met een kop koffie", "Gebouwd met veel hulp van Claude Opus 5.5"],
    ["es", "¿Quién hizo esto?", "Un dibujo de Juan David con una taza de café", "Hecha con mucha ayuda de Claude Opus 5.5"],
  ] as const) {
    it(`shows the maker's portrait next to the GitHub link and says Claude helped build it (${language})`, async () => {
      const { wrapper } = await mountApp(AboutContent, { language, stubs: { KeyGuide: true } });
      const section = wrapper.findAll("section").find((s) => s.find("h2").text().includes(heading))!;
      const img = section.find("img");
      expect(img.attributes("alt")).toBe(alt);
      expect(img.attributes("src")).toMatch(/maker\.svg/);
      // right before the name, and in one block with the link (which wraps under them on the smallest screens)
      expect(img.element.nextElementSibling?.textContent).toContain("Juan David Muñoz");
      const link = section.find('a[href="https://github.com/juancho0202"]');
      expect(link.element.parentElement).toBe(img.element.parentElement);
      expect(section.text()).toContain(claude);
    });
  }
});

describe("AboutContent links", () => {
  it("links to other sites (GitHub, Piper) open in a new tab, so the app stays open", async () => {
    const { wrapper } = await mountApp(AboutContent, { language: "en", stubs: { KeyGuide: true } });
    const external = wrapper.findAll("a").filter((a) => /^https?:/.test(a.attributes("href") ?? ""));
    expect(external.map((a) => a.text())).toEqual(expect.arrayContaining(["Piper", "github.com/juancho0202"]));
    for (const a of external) {
      expect(a.attributes("target"), a.text()).toBe("_blank");
      expect(a.attributes("rel"), a.text()).toBe("noopener noreferrer");
    }
  });
});
