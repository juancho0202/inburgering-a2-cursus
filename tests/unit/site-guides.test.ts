// The guide pages in every language, the sitemap and robots.txt (scripts/site.ts, site/guides/<lang>/*.md).
import { describe, expect, it } from "vitest";
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { guideIcon, guidePath, guidesPath, loadAllGuides, parseGuide, robotsTxt, SITE_LANGUAGES, sitePages, SITE_URL } from "../../scripts/site";

const all = loadAllGuides();
const guides = all.en;
const pages = sitePages();
const file = (p: string) => `${p.slice(1)}index.html`;
const ldJson = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const between = (html: string, a: string, b: string) => html.slice(html.indexOf(a), html.indexOf(b));

describe("guides", () => {
  it("has the three DUO process guides and the A2 exam guide", () => {
    expect(guides.map((g) => g.slug)).toEqual(["mijn-inburgering-login", "book-inburgering-exam", "inburgering-exam-results", "inburgering-a2-exam"]);
  });

  it("every language has every guide, in the same order and with the same picture", () => {
    for (const lang of SITE_LANGUAGES) expect(all[lang.code].map((g) => [g.slug, g.order, g.icon]), lang.code).toEqual(guides.map((g) => [g.slug, g.order, g.icon]));
  });

  for (const lang of SITE_LANGUAGES) for (const g of all[lang.code]) {
    describe(`${lang.code}: ${g.slug}`, () => {
      const s = lang.strings;
      const html = pages[file(guidePath(g, lang))];
      const head = between(html, "<head>", "</head>");

      it("is a full page of its own in its language, with its title, description, canonical and one heading", () => {
        expect(html.startsWith("<!doctype html>")).toBe(true);
        expect(html).toContain(`<html lang="${lang.code}">`);
        expect(head).toContain(`<link rel="canonical" href="${SITE_URL}${guidePath(g, lang)}" />`);
        expect(head).toContain(`<meta property="og:locale" content="${lang.ogLocale}" />`);
        expect(head).toMatch(/<title>[^<]{20,70}<\/title>/);
        expect(g.description.length, "description length").toBeLessThanOrEqual(160);
        expect(html.match(/<h1>/g)).toHaveLength(1);
        expect(html).toContain('<link rel="stylesheet" href="/site.css" />');
      });

      it("does not load the app", () => {
        expect(html).not.toMatch(/<script(?! type="application\/ld\+json")/);
      });

      it("says in its language when it was checked and that it is unofficial, and dates its structured data the same", () => {
        const [label] = s.guide.lastChecked.split("{date}");
        const year = g.lastChecked.slice(0, 4);
        expect(html).toMatch(new RegExp(`${label}\\d{1,2}( de)? \\p{L}+( de)? ${year}\\. ${s.guide.unofficial.slice(0, 20)}`, "u"));
        expect(ldJson(head)[0]).toMatchObject({ "@type": "Article", headline: g.heading, dateModified: g.lastChecked, inLanguage: lang.code });
      });

      it("ends with the other guides in its language as cards, not itself", () => {
        const more = html.slice(html.indexOf(`<h2>${s.guide.more}</h2>`));
        expect(more.match(/class="site-card site-card-link site-card-guide"/g)).toHaveLength(guides.length - 1);
        for (const other of all[lang.code].filter((o) => o !== g)) expect(more).toContain(`<a href="${guidePath(other, lang)}">${other.heading}</a>`);
        expect(more).not.toContain(`href="${guidePath(g, lang)}"`);
        expect(more).toContain(`<a href="${guidesPath(lang)}">${s.guide.allGuides}</a>`);
      });

      it("has a language menu that opens this guide in each language, and tells search engines about them", () => {
        const menu = between(html, '<details class="site-lang">', "</details>");
        for (const other of SITE_LANGUAGES) {
          const current = other === lang ? ' aria-current="page"' : "";
          expect(menu).toContain(`<a href="${guidePath(g, other)}" hreflang="${other.code}" lang="${other.code}"${current}>${other.name}</a>`);
          expect(head).toContain(`<link rel="alternate" hreflang="${other.code}" href="${SITE_URL}${guidePath(g, other)}" />`);
        }
        expect(head).toContain(`<link rel="alternate" hreflang="x-default" href="${SITE_URL}${guidePath(g)}" />`);
      });

      it("keeps the reader in its language: links to our pages stay in this language", () => {
        const body = html.slice(html.indexOf("</details>"));
        const own = [...body.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]).filter((h) => !/\.(css|svg|png)$/.test(h));
        const inLang = (h: string) => (lang.code === "en" ? !SITE_LANGUAGES.some((l) => l.code !== "en" && h.startsWith(l.path)) && !h.includes("lang=") : h.startsWith(lang.path) || h === `/?lang=${lang.code}`);
        expect(own.filter((h) => !inLang(h))).toEqual([]);
      });

      it("opens links to other sites in a new tab, and our own pages in the same tab", () => {
        const links = [...html.matchAll(/<a href="([^"]+)"([^>]*)>/g)].map((m) => ({ href: m[1], attrs: m[2] }));
        const external = links.filter((l) => /^https?:/.test(l.href));
        expect(external.length).toBeGreaterThan(0);
        for (const l of external) expect(l.attrs, l.href).toBe(' target="_blank" rel="noopener noreferrer"');
        for (const l of links.filter((l) => l.href.startsWith("/"))) expect(l.attrs, l.href).not.toContain("_blank");
      });

      it("links to the official DUO pages and to the app in its language", () => {
        expect(html).toMatch(/href="https:\/\/www\.inburgeren\.nl\//);
        expect(html).toContain(`<a class="site-start" href="${lang.code === "en" ? "/welkom" : `/?lang=${lang.code}`}">${s.landing.start}</a>`);
      });

      it("every link to our own pages goes to a page that exists", () => {
        const own = [...html.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]).filter((h) => !/\.(css|svg|png)$/.test(h));
        const exists = (h: string) => h === "/" || h === "/welkom" || SITE_LANGUAGES.some((l) => h === `/?lang=${l.code}`) || file(h) in pages;
        expect(own.filter((h) => !exists(h))).toEqual([]);
      });
    });
  }

  for (const lang of SITE_LANGUAGES) {
    it(`the guides page in ${lang.name} lists every guide in that language`, () => {
      const index = pages[file(guidesPath(lang))];
      expect(index).toContain(`<html lang="${lang.code}">`);
      expect(index).toContain(`<h1>${lang.strings.guide.indexHeading}</h1>`);
      for (const g of all[lang.code]) expect(index).toContain(`<a href="${guidePath(g, lang)}">${g.heading}</a>`);
      expect(index).toContain(`<link rel="canonical" href="${SITE_URL}${guidesPath(lang)}" />`);
      for (const other of SITE_LANGUAGES) expect(index).toContain(`<link rel="alternate" hreflang="${other.code}" href="${SITE_URL}${guidesPath(other)}" />`);
    });
  }

  it("a guide missing from one language stops the build", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "guides-"));
    try {
      cpSync(path.resolve(__dirname, "../../site/guides"), dir, { recursive: true });
      expect(() => loadAllGuides(dir)).not.toThrow();
      rmSync(path.join(dir, "es", "inburgering-exam-results.md"));
      expect(() => loadAllGuides(dir)).toThrow(/site\/guides\/es must have the same guides as site\/guides\/en/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("a guide's Markdown cannot put raw HTML in the page", () => {
    const g = parseGuide("x.md", "---\nslug: x\norder: 9\ntitle: T\ndescription: D\nheading: H\nlastChecked: 2026-01-01\nicon: laptop\n---\n<script>x()</script> [a](javascript:x())\n");
    const html = sitePages({ en: [g], nl: [g], es: [g] })["guides/x/index.html"];
    expect(html).not.toContain("<script>x()");
    expect(html).not.toContain('href="javascript:');
  });

  it("a guide without a required field or with a bad date stops the build", () => {
    const ok = "---\nslug: x\norder: 1\ntitle: T\ndescription: D\nheading: H\nlastChecked: 2026-01-01\nicon: laptop\n---\nbody";
    expect(() => parseGuide("a.md", ok.replace("heading: H\n", ""))).toThrow(/a\.md: missing "heading"/);
    expect(() => parseGuide("a.md", ok.replace("2026-01-01", "28 Oct"))).toThrow(/lastChecked/);
    expect(() => parseGuide("a.md", ok.replace("slug: x", "slug: Not OK"))).toThrow(/slug/);
    expect(() => parseGuide("a.md", "no front matter")).toThrow(/front matter/);
    expect(() => parseGuide("a.md", ok.replace("icon: laptop\n", ""))).toThrow(/a\.md: missing "icon"/);
    expect(() => parseGuide("a.md", ok.replace("icon: laptop", "icon: ../secret"))).toThrow(/icon/);
  });
});

describe("guide card pictures", () => {
  const dir = path.resolve(__dirname, "../../site/icons");
  const files = readdirSync(dir).filter((f) => f.endsWith(".svg"));

  it("every guide has its own picture, and every picture is used", () => {
    const used = guides.map((g) => g.icon);
    expect(new Set(used).size).toBe(guides.length);
    expect(files.map((f) => f.replace(".svg", "")).sort()).toEqual([...used].sort());
  });

  it("pictures are portrait, themed by the stylesheet, and safe to repeat on a page", () => {
    for (const f of files) {
      const svg = readFileSync(path.join(dir, f), "utf8");
      expect(svg, f).toContain('viewBox="0 0 96 128"');
      // the security policy blocks style attributes; ids would clash when a page shows several pictures
      expect(svg, f).not.toMatch(/\sstyle=|\sid=|<style|<script|\son\w+=/);
      // colours come from classes in site.css, so dark mode works
      expect(svg, f).not.toMatch(/\s(fill|stroke)="#/);
    }
  });

  it("a picture is decorative: hidden from screen readers and from keyboard focus", () => {
    expect(guideIcon("laptop")).toMatch(/^<svg class="site-guide-icon" aria-hidden="true" focusable="false" /);
  });

  it("a missing picture stops the build", () => {
    expect(() => guideIcon("does-not-exist")).toThrow(/site\/icons\/does-not-exist\.svg does not exist/);
  });
});

describe("search files", () => {
  it("the sitemap lists the landing page, the guides page and every guide in every language, and no app screens", () => {
    const locs = [...pages["sitemap.xml"].matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    const guideUrls = (prefix: string) => [`${SITE_URL}${prefix}guides/`, ...guides.map((g) => `${SITE_URL}${prefix}guides/${g.slug}/`)];
    expect(locs).toEqual([`${SITE_URL}/`, `${SITE_URL}/nl/`, `${SITE_URL}/es/`, ...guideUrls("/"), ...guideUrls("/nl/"), ...guideUrls("/es/")]);
  });

  it("robots.txt allows crawling and points to the sitemap", () => {
    expect(robotsTxt()).toContain("Allow: /");
    expect(robotsTxt()).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });
});
