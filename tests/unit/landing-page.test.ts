// The landing page written into index.html at build time (scripts/site.ts).
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fillIndexHtml, loadGuides, SITE_URL, type SiteStrings } from "../../scripts/site";
import en from "../../site/strings/en.json";

const indexHtml = readFileSync(path.resolve(__dirname, "../../index.html"), "utf8");
const page = fillIndexHtml(indexHtml);
const head = page.slice(0, page.indexOf("</head>"));
const body = page.slice(page.indexOf("<body>"));
const ldJson = (html: string) => [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map((m) => JSON.parse(m[1]));

describe("landing page in index.html", () => {
  it("has the practice-exam title, description and canonical address in <head>", () => {
    expect(head).toContain("<title>Inburgering Practice Exam (Free, A2) | Train for Inburgering</title>");
    expect(head).toMatch(/<meta name="description" content="Free inburgering practice exam[^"]+" \/>/);
    expect(head).toContain(`<link rel="canonical" href="${SITE_URL}/" />`);
    expect(page).toContain('<html lang="en">');
  });

  it("shares with a 1200×630 picture and a large card", () => {
    expect(head).toContain(`<meta property="og:image" content="${SITE_URL}/og-image.png" />`);
    expect(head).toContain('<meta property="og:image:width" content="1200" />');
    expect(head).toContain('<meta property="og:image:height" content="630" />');
    expect(head).toContain('<meta name="twitter:card" content="summary_large_image" />');
    const png = readFileSync(path.resolve(__dirname, "../../public/og-image.png"));
    // width and height in the PNG header
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });

  it("tells search engines the site's name with spaces and that the app is free", () => {
    const data = ldJson(head);
    expect(data.find((d) => d["@type"] === "WebSite")).toMatchObject({ name: "Train for Inburgering", url: `${SITE_URL}/` });
    expect(data.find((d) => d["@type"] === "WebApplication")).toMatchObject({ offers: { price: "0", priceCurrency: "EUR" } });
  });

  it("puts the heading, the start link, the FAQ and the guide links in the HTML itself", () => {
    expect(body).toContain("<h1>Free inburgering practice exam (A2)</h1>");
    expect(body.match(/<a class="site-start" href="\/welkom">Start practising, it's free<\/a>/g)).toHaveLength(2);
    expect(body).toContain("<h2>Frequently asked questions</h2>");
    for (const g of loadGuides()) expect(body).toContain(`<a href="/guides/${g.slug}/">`);
    // the landing page comes before the app's mount point, and the app is still there
    expect(body.indexOf('id="landing"')).toBeLessThan(body.indexOf('<div id="app">'));
  });

  it("shows the FAQ as accordions: every answer in the HTML, only the first one open", () => {
    const items = [...body.matchAll(/<details( open)?>\s*<summary>([^<]+)<\/summary>\s*<p>/g)];
    expect(items.map((m) => m[2])).toEqual(en.landing.faq.map((f) => f.q.replace(/'/g, "'")));
    expect(items.map((m) => !!m[1])).toEqual(en.landing.faq.map((_, i) => i === 0));
  });

  it("says plainly that Speaking is not in the app yet", () => {
    expect(body).toContain("<h3>Speaking (Spreken): not yet</h3>");
    expect(body).toMatch(/Speaking is not in the app yet/);
  });

  it("loads only the small start script and its own styles up front, not the app", () => {
    expect(head).toContain('<script src="/boot.js"></script>');
    expect(head).toContain('<link rel="stylesheet" href="/site.css" />');
    const main = readFileSync(path.resolve(__dirname, "../../src/main.ts"), "utf8");
    // everything heavy comes in through the dynamic import
    expect(main.match(/^import .*$/gm)).toEqual(['import { hasLocalData, startApp } from "./lib/landing";']);
    expect(main).toContain('import("./app")');
  });

  it("shows every string from the strings file and leaves no marker behind", () => {
    const l = en.landing;
    const all = [en.meta.title, en.meta.description, l.brand, l.heading, l.partsHeading, l.whyHeading, l.guidesHeading, l.faqHeading, l.disclaimer];
    for (const item of [...l.parts, ...l.why]) all.push(item.title, item.text);
    for (const f of l.faq) all.push(f.q);
    for (const text of all) expect(page).toContain(text.replace(/&/g, "&amp;").replace(/"/g, "&quot;"));
    expect(page).not.toContain("landing:");
  });

  it("FAQ answers can hold a link, but never raw HTML", () => {
    expect(body).toContain('<a href="https://www.inburgeren.nl/en/taking-the-integration-exam/practicing.jsp">official practice exams</a>');
    const evil = structuredClone(en) as SiteStrings;
    evil.landing.faq = [{ q: "<b>q</b>", a: 'x <img src=x onerror=alert(1)> [y](javascript:alert(1))' }];
    const html = fillIndexHtml(indexHtml, evil);
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>q</b>");
    expect(html).not.toContain('href="javascript:');
  });

  it("escapes copy, so a translation can never inject HTML", () => {
    const evil = structuredClone(en) as SiteStrings;
    evil.meta.title = "A </title><script>x()</script>";
    evil.landing.heading = "<img src=x onerror=alert(1)>";
    evil.meta.siteName = "</script><script>x()</script>";
    const html = fillIndexHtml(indexHtml, evil);
    expect(html).not.toContain("<script>x()");
    expect(html).not.toContain("<img src=x");
    // the structured data still reads back as the same name
    expect(ldJson(html).find((d) => d["@type"] === "WebSite").name).toBe("</script><script>x()</script>");
  });

  it("fails the build when index.html lost a marker", () => {
    expect(() => fillIndexHtml(indexHtml.replace("<!-- landing:body -->", ""))).toThrow(/landing:body/);
  });
});
