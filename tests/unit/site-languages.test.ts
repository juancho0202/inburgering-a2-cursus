// The landing page in every language of the app, and the language menu that links them (scripts/site.ts).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fillIndexHtml, SITE_LANGUAGES, SITE_URL, STATIC_DIRS, sitePages, type SiteLanguage } from "../../scripts/site";
import { UI_LANGUAGES } from "../../shared/schemas/store";

const indexHtml = readFileSync(path.resolve(__dirname, "../../index.html"), "utf8");
const pages = sitePages();
/** The landing page as a visitor gets it: "/" is index.html (with the app), the others are pages of their own. */
const landing = (l: SiteLanguage) => (l.path === "/" ? fillIndexHtml(indexHtml) : pages[`${l.code}/index.html`]);
const head = (html: string) => html.slice(0, html.indexOf("</head>"));
const menu = (html: string) => html.slice(html.indexOf('<details class="site-lang">'), html.indexOf("</details>", html.indexOf('<details class="site-lang">')));
const ldJson = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const encoded = (t: string) => t.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

describe("a landing page for every app language", () => {
  it("covers exactly the languages of the app", () => {
    expect(SITE_LANGUAGES.map((l) => l.code).sort()).toEqual([...UI_LANGUAGES].sort());
    expect(SITE_LANGUAGES[0]).toMatchObject({ code: "en", path: "/" });
  });

  it("the other languages are pages of their own, which the app's offline copy must leave alone", () => {
    expect(Object.keys(pages)).toEqual(expect.arrayContaining(["nl/index.html", "es/index.html"]));
    expect(STATIC_DIRS).toEqual(expect.arrayContaining(["guides", "nl", "es"]));
    expect(readFileSync(path.resolve(__dirname, "../../vite.config.ts"), "utf8")).toContain("...STATIC_DIRS.map(");
  });

  it("every language has the same sections and as many cards and questions", () => {
    const [en, ...others] = SITE_LANGUAGES.map((l) => l.strings);
    for (const s of others) {
      for (const key of ["parts", "why", "faq"] as const) expect(s.landing[key].length, key).toBe(en.landing[key].length);
    }
  });

  for (const lang of SITE_LANGUAGES) {
    describe(lang.name, () => {
      const html = landing(lang);
      const s = lang.strings;

      it("is in its own language, with its own title, description and address", () => {
        expect(html).toContain(`<html lang="${lang.code}">`);
        expect(head(html)).toContain(`<title>${s.meta.title}</title>`);
        expect(head(html)).toContain(`<meta name="description" content="${encoded(s.meta.description)}" />`);
        expect(head(html)).toContain(`<link rel="canonical" href="${SITE_URL}${lang.path}" />`);
        expect(head(html)).toContain(`<meta property="og:locale" content="${lang.ogLocale}" />`);
        expect(s.meta.title.length, "title length").toBeLessThanOrEqual(70);
        expect(s.meta.description.length, "description length").toBeLessThanOrEqual(160);
        expect(ldJson(head(html)).find((d) => d["@type"] === "WebApplication").inLanguage).toBe(lang.code);
      });

      it("tells search engines about every language version, with English as the default", () => {
        for (const other of SITE_LANGUAGES) expect(head(html)).toContain(`<link rel="alternate" hreflang="${other.code}" href="${SITE_URL}${other.path}" />`);
        expect(head(html)).toContain(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}/" />`);
      });

      it("shows all of its own copy", () => {
        const l = s.landing;
        const all = [l.heading, l.tagline, l.start, l.partsHeading, l.whyHeading, l.guidesHeading, l.faqHeading, l.disclaimer];
        for (const item of [...l.parts, ...l.why]) all.push(item.title, item.text);
        for (const f of l.faq) all.push(f.q);
        for (const text of all) expect(html).toContain(encoded(text));
      });

      it(lang.path === "/" ? "opens the app in the browser's language (the default page for everyone)" : "opens the app in this language", () => {
        const href = lang.path === "/" ? "/welkom" : `/\\?lang=${lang.code}`;
        expect(html.match(new RegExp(`<a class="site-start" href="${href}">`, "g"))).toHaveLength(2);
      });

      it("has a language menu that names this language for screen readers and links to every language", () => {
        const m = menu(html);
        expect(m).toContain(`<span class="site-sr">${s.landing.language}: ${lang.name}</span>`);
        for (const other of SITE_LANGUAGES) {
          const current = other === lang ? ' aria-current="page"' : "";
          expect(m).toContain(`<a href="${other.path}" hreflang="${other.code}" lang="${other.code}"${current}>${other.name}</a>`);
        }
        expect(m.match(/aria-current/g)).toHaveLength(1);
      });

      it("the logo goes to the landing page in this language", () => {
        expect(html).toContain(`<a href="${lang.path}" class="site-brand">`);
      });

      it("marks the English guides as English when the page is not", () => {
        const guides = html.slice(html.indexOf(`<h2>${s.landing.guidesHeading}</h2>`));
        if (lang.code === "en") {
          expect(guides).toMatch(/^<h2>[^<]+<\/h2>\s*<ul class="site-cards site-cards-wide">/);
        } else {
          expect(guides).toContain(`<p class="site-section-note">${s.landing.guidesNote}</p>`);
          expect(guides).toContain('<ul class="site-cards site-cards-wide" lang="en">');
        }
      });
    });
  }

  it("a language page loads no app code", () => {
    for (const lang of SITE_LANGUAGES.filter((l) => l.path !== "/")) {
      expect(landing(lang)).not.toMatch(/<script(?! type="application\/ld\+json")/);
    }
  });
});
