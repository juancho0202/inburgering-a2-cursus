// The guide pages, the sitemap and robots.txt (scripts/site.ts, site/guides/en/*.md).
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { guideIcon, loadGuides, parseGuide, robotsTxt, sitePages, SITE_URL } from "../../scripts/site";

const guides = loadGuides();
const pages = sitePages();
const ldJson = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
const between = (html: string, a: string, b: string) => html.slice(html.indexOf(a), html.indexOf(b));

describe("guides", () => {
  it("has the three DUO process guides and the A2 exam guide", () => {
    expect(guides.map((g) => g.slug)).toEqual(["mijn-inburgering-login", "book-inburgering-exam", "inburgering-exam-results", "inburgering-a2-exam"]);
  });

  for (const g of guides) {
    describe(g.slug, () => {
      const html = pages[`guides/${g.slug}/index.html`];
      const head = between(html, "<head>", "</head>");

      it("is a full page of its own with its title, description, canonical and one heading", () => {
        expect(html.startsWith("<!doctype html>")).toBe(true);
        expect(head).toContain(`<link rel="canonical" href="${SITE_URL}/guides/${g.slug}/" />`);
        expect(head).toMatch(/<title>[^<]{20,70}<\/title>/);
        expect(g.description.length, "description length").toBeLessThanOrEqual(160);
        expect(html.match(/<h1>/g)).toHaveLength(1);
        expect(html).toContain('<link rel="stylesheet" href="/site.css" />');
      });

      it("does not load the app", () => {
        expect(html).not.toMatch(/<script(?! type="application\/ld\+json")/);
      });

      it("says when it was checked and that it is unofficial, and dates its structured data the same", () => {
        expect(html).toMatch(/Last checked: \d{1,2} \w+ 20\d\d\. This is an unofficial guide/);
        expect(ldJson(head)[0]).toMatchObject({ "@type": "Article", headline: g.heading, dateModified: g.lastChecked });
      });

      it("ends with the other guides as cards, not itself", () => {
        const more = html.slice(html.indexOf("<h2>More guides</h2>"));
        expect(more.match(/class="site-card site-card-link site-card-guide"/g)).toHaveLength(guides.length - 1);
        expect(more).not.toContain(`href="/guides/${g.slug}/"`);
      });

      it("opens links to other sites in a new tab, and our own pages in the same tab", () => {
        const links = [...html.matchAll(/<a href="([^"]+)"([^>]*)>/g)].map((m) => ({ href: m[1], attrs: m[2] }));
        const external = links.filter((l) => /^https?:/.test(l.href));
        expect(external.length).toBeGreaterThan(0);
        for (const l of external) expect(l.attrs, l.href).toBe(' target="_blank" rel="noopener noreferrer"');
        for (const l of links.filter((l) => l.href.startsWith("/"))) expect(l.attrs, l.href).not.toContain("_blank");
      });

      it("links to the official DUO pages and to the app", () => {
        expect(html).toMatch(/href="https:\/\/www\.inburgeren\.nl\//);
        expect(html).toContain('<a class="site-start" href="/welkom">');
      });

      it("every link to our own pages goes to a page that exists", () => {
        const own = [...html.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]).filter((h) => !/\.(css|svg|png)$/.test(h));
        const exists = (h: string) => h === "/" || h === "/welkom" || `${h.slice(1)}index.html` in pages;
        expect(own.filter((h) => !exists(h))).toEqual([]);
      });
    });
  }

  it("the guides page lists every guide", () => {
    const index = pages["guides/index.html"];
    for (const g of guides) expect(index).toContain(`<a href="/guides/${g.slug}/">`);
    expect(index).toContain(`<link rel="canonical" href="${SITE_URL}/guides/" />`);
  });

  it("a guide's Markdown cannot put raw HTML in the page", () => {
    const g = parseGuide("x.md", "---\nslug: x\norder: 9\ntitle: T\ndescription: D\nheading: H\nlastChecked: 2026-01-01\nicon: laptop\n---\n<script>x()</script> [a](javascript:x())\n");
    const html = sitePages(undefined, [g])["guides/x/index.html"];
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
  it("the sitemap lists the landing page in every language, the guides page and every guide, and no app screens", () => {
    const locs = [...pages["sitemap.xml"].matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([`${SITE_URL}/`, `${SITE_URL}/nl/`, `${SITE_URL}/es/`, `${SITE_URL}/guides/`, ...guides.map((g) => `${SITE_URL}/guides/${g.slug}/`)]);
  });

  it("robots.txt allows crawling and points to the sitemap", () => {
    expect(robotsTxt()).toContain("Allow: /");
    expect(robotsTxt()).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });
});
