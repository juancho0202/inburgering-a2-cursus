/**
 * The public landing page and the files search engines read (sitemap.xml, robots.txt).
 *
 * The landing page is written into index.html at build time, so search engines and first-time visitors get real
 * text without running the app. Learners who have started skip it before the first paint (public/boot.js).
 * All copy lives in site/strings/<lang>.json so it can be translated later.
 */
import type { Plugin } from "vite";
import en from "../site/strings/en.json";

export const SITE_URL = "https://trainforinburgering.com";

export type SiteStrings = typeof en;
type Item = { title: string; text: string };

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Title, description, canonical and Open Graph tags for <head>. */
export function renderHead(s: SiteStrings): string {
  const url = `${SITE_URL}/`;
  return [
    `<title>${esc(s.meta.title)}</title>`,
    `<meta name="description" content="${esc(s.meta.description)}" />`,
    // Every app screen is served from this same file; they all point here, so only the landing page is indexed.
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${esc(s.meta.siteName)}" />`,
    `<meta property="og:title" content="${esc(s.meta.ogTitle)}" />`,
    `<meta property="og:description" content="${esc(s.meta.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE_URL}/icons/icon-512.png" />`,
  ].join("\n    ");
}

const cards = (items: Item[]) =>
  items.map((i) => `<li class="landing-card"><h3>${esc(i.title)}</h3><p>${esc(i.text)}</p></li>`).join("\n          ");

/** The landing page body. The start link opens the welcome screen, which also marks the learner as started. */
export function renderLanding(s: SiteStrings): string {
  const l = s.landing;
  return `<div id="landing">
      <header class="landing-top"><span class="landing-logo" aria-hidden="true">NL</span> ${esc(l.brand)}</header>
      <main class="landing-main">
        <section class="landing-hero">
          <h1>${esc(l.heading)}</h1>
          <p class="landing-tagline">${esc(l.tagline)}</p>
          <a class="landing-start" href="/welkom">${esc(l.start)}</a>
        </section>
        <section>
          <h2>${esc(l.partsHeading)}</h2>
          <ul class="landing-cards">
          ${cards(l.parts)}
          </ul>
        </section>
        <section>
          <h2>${esc(l.whyHeading)}</h2>
          <ul class="landing-cards">
          ${cards(l.why)}
          </ul>
        </section>
        <p class="landing-disclaimer">${esc(l.disclaimer)}</p>
        <a class="landing-start" href="/welkom">${esc(l.start)}</a>
      </main>
    </div>`;
}

/** Only the landing page belongs in search results; app screens hold personal progress. */
export const sitemapXml = () =>
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${SITE_URL}/</loc></url>\n</urlset>\n`;

export const robotsTxt = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;

/** Fills the <!-- landing:head --> and <!-- landing:body --> markers in index.html. */
export function fillIndexHtml(html: string, s: SiteStrings = en): string {
  for (const marker of ["<!-- landing:head -->", "<!-- landing:body -->"]) {
    if (!html.includes(marker)) throw new Error(`index.html is missing ${marker}`);
  }
  return html.replace("<!-- landing:head -->", renderHead(s)).replace("<!-- landing:body -->", renderLanding(s));
}

export function landingPlugin(): Plugin {
  return {
    name: "landing-page",
    transformIndexHtml: (html) => fillIndexHtml(html),
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemapXml() });
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robotsTxt() });
    },
  };
}
