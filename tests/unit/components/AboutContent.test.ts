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
      expect(section!.text()).toContain(`${madeBy} Juan Muñoz`);
      const link = section!.findAll("a").find((a) => a.text() === "github.com/juancho0202");
      expect(link?.attributes("href")).toBe("https://github.com/juancho0202");
    });
  }

  it("keeps browser translators off the name and the username", async () => {
    const { wrapper } = await mountApp(AboutContent, { language: "en", stubs: { KeyGuide: true } });
    const name = wrapper.findAll("strong").find((s) => s.text() === "Juan Muñoz");
    const link = wrapper.findAll("a").find((a) => a.text() === "github.com/juancho0202");
    expect(name?.attributes("translate")).toBe("no");
    expect(link?.attributes("translate")).toBe("no");
  });
});
