// The landing page and search files written at build time (scripts/landingPage.ts).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { fillIndexHtml, robotsTxt, sitemapXml, SITE_URL, type SiteStrings } from "../../scripts/landingPage";
import en from "../../site/strings/en.json";

const indexHtml = readFileSync(new URL("../../index.html", import.meta.url), "utf8");
const page = fillIndexHtml(indexHtml);

describe("landing page in index.html", () => {
  it("has the practice-exam title, description and canonical address in <head>", () => {
    const head = page.slice(0, page.indexOf("</head>"));
    expect(head).toContain("<title>Inburgering Practice Exam (Free, A2) | TrainForInburgering</title>");
    expect(head).toMatch(/<meta name="description" content="Free inburgering practice exam[^"]+" \/>/);
    expect(head).toContain(`<link rel="canonical" href="${SITE_URL}/" />`);
    expect(head).toContain('<meta property="og:title" content="Free inburgering practice exam (A2)" />');
    expect(page).toContain('<html lang="en">');
  });

  it("puts the heading and the start link in the HTML itself (no JavaScript needed to read it)", () => {
    const body = page.slice(page.indexOf("<body>"));
    expect(body).toContain("<h1>Free inburgering practice exam (A2)</h1>");
    expect(body.match(/<a class="landing-start" href="\/welkom">Start practising, it's free<\/a>/g)).toHaveLength(2);
    // the landing page comes before the app's mount point, and the app is still there
    expect(body.indexOf('id="landing"')).toBeLessThan(body.indexOf('<div id="app">'));
  });

  it("decides landing-or-app in <head>, before the body is painted", () => {
    const head = page.slice(0, page.indexOf("</head>"));
    expect(head).toContain('<script src="/boot.js"></script>');
    expect(head).toContain('href="/src/styles/landing.css"');
  });

  it("shows every string from the strings file and leaves no marker behind", () => {
    const all = [...Object.values(en.meta), en.landing.brand, en.landing.heading, en.landing.partsHeading, en.landing.whyHeading, en.landing.disclaimer];
    for (const item of [...en.landing.parts, ...en.landing.why]) all.push(item.title, item.text);
    for (const text of all) expect(page).toContain(text.replace(/&/g, "&amp;").replace(/"/g, "&quot;"));
    expect(page).not.toContain("landing:");
  });

  it("escapes copy, so a translation can never inject HTML", () => {
    const evil = structuredClone(en) as SiteStrings;
    evil.meta.title = 'A </title><script>x()</script>';
    evil.landing.heading = "<img src=x onerror=alert(1)>";
    evil.meta.description = 'say "hi"';
    const html = fillIndexHtml(indexHtml, evil);
    expect(html).not.toContain("<script>x()");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain('content="say &quot;hi&quot;"');
  });

  it("fails the build when index.html lost a marker", () => {
    expect(() => fillIndexHtml(indexHtml.replace("<!-- landing:body -->", ""))).toThrow(/landing:body/);
  });
});

describe("search files", () => {
  it("the sitemap lists only the landing page; app screens stay out", () => {
    expect(sitemapXml().match(/<loc>/g)).toHaveLength(1);
    expect(sitemapXml()).toContain(`<loc>${SITE_URL}/</loc>`);
  });

  it("robots.txt allows crawling and points to the sitemap", () => {
    expect(robotsTxt()).toContain("Allow: /");
    expect(robotsTxt()).toContain(`Sitemap: ${SITE_URL}/sitemap.xml`);
  });
});
