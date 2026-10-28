/**
 * The public pages: the landing page and the guides, plus the files search engines read (sitemap.xml, robots.txt).
 *
 * The landing page is written into index.html at build time, so search engines and first-time visitors get real
 * text without running the app. Learners who have started skip it before the first paint (public/boot.js).
 * The guides are plain HTML pages under /guides/ with no app at all.
 * Short copy lives in site/strings/<lang>.json and each guide in site/guides/<lang>/<slug>.md, so both can be
 * translated later.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import MarkdownIt from "markdown-it";
import type { Plugin } from "vite";
import en from "../site/strings/en.json";

export const SITE_URL = "https://trainforinburgering.com";
const GUIDES_DIR = path.resolve(__dirname, "../site/guides/en");

export type SiteStrings = typeof en;
type Item = { title: string; text: string };

export interface Guide {
  slug: string;
  /** <title> */
  title: string;
  description: string;
  /** <h1> */
  heading: string;
  /** YYYY-MM-DD: when the facts were last compared with DUO's own pages. */
  lastChecked: string;
  /** Position in lists. */
  order: number;
  /** Markdown */
  body: string;
}

// html off: a guide or a translation can never put raw markup in the page.
const md = new MarkdownIt({ html: false });

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Inside <script type="application/ld+json">, "<" could end the block early.
const jsonLd = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

export const guidePath = (g: Guide) => `/guides/${g.slug}/`;

const REQUIRED = ["slug", "title", "description", "heading", "lastChecked", "order"] as const;

/** A guide file: front matter (`key: value` lines between `---`), then Markdown. */
export function parseGuide(file: string, src: string): Guide {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(src.replace(/\r\n/g, "\n"));
  if (!m) throw new Error(`${file}: missing front matter`);
  const meta: Record<string, string> = {};
  for (const line of m[1].split("\n")) {
    const i = line.indexOf(":");
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  for (const key of REQUIRED) if (!meta[key]) throw new Error(`${file}: missing "${key}"`);
  if (!/^[a-z0-9-]+$/.test(meta.slug)) throw new Error(`${file}: slug must be lowercase words with dashes`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.lastChecked)) throw new Error(`${file}: lastChecked must be YYYY-MM-DD`);
  return { slug: meta.slug, title: meta.title, description: meta.description, heading: meta.heading, lastChecked: meta.lastChecked, order: Number(meta.order), body: m[2] };
}

export function loadGuides(dir = GUIDES_DIR): Guide[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => parseGuide(f, readFileSync(path.join(dir, f), "utf8")))
    .sort((a, b) => a.order - b.order);
}

const formatDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

interface HeadOptions {
  title: string;
  description: string;
  path: string;
  ogTitle: string;
  ogType: "website" | "article";
  data: unknown[];
}

/** Title, description, canonical, Open Graph, share card and structured data. */
function headTags(s: SiteStrings, o: HeadOptions): string {
  const url = `${SITE_URL}${o.path}`;
  return [
    `<title>${esc(o.title)}</title>`,
    `<meta name="description" content="${esc(o.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="${o.ogType}" />`,
    `<meta property="og:site_name" content="${esc(s.meta.siteName)}" />`,
    `<meta property="og:title" content="${esc(o.ogTitle)}" />`,
    `<meta property="og:description" content="${esc(o.description)}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${SITE_URL}/og-image.png" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="${esc(s.meta.ogImageAlt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    ...o.data.map(jsonLd),
  ].join("\n    ");
}

/** The tags for index.html. Every app screen is served from that same file, so they all point to "/". */
export function renderHead(s: SiteStrings): string {
  const url = `${SITE_URL}/`;
  return headTags(s, {
    title: s.meta.title,
    description: s.meta.description,
    path: "/",
    ogTitle: s.meta.ogTitle,
    ogType: "website",
    data: [
      { "@context": "https://schema.org", "@type": "WebSite", name: s.meta.siteName, alternateName: "TrainForInburgering", url },
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: s.meta.siteName,
        url,
        description: s.meta.description,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Any (web browser)",
        inLanguage: "en",
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      },
    ],
  });
}

const cards = (items: Item[]) =>
  items.map((i) => `<li class="site-card"><h3>${esc(i.title)}</h3><p>${esc(i.text)}</p></li>`).join("\n          ");

/** Guides as cards. The link is the title; a stretched ::after makes the whole card clickable. */
const guideCards = (guides: Guide[]) =>
  `<ul class="site-cards site-cards-wide">
          ${guides.map((g) => `<li class="site-card site-card-link"><h3><a href="${guidePath(g)}">${esc(g.heading)}</a></h3><p>${esc(g.description)}</p></li>`).join("\n          ")}
          </ul>`;

const brandBar = (s: SiteStrings) =>
  `<header class="site-top"><a href="/" class="site-brand"><span class="site-logo" aria-hidden="true">NL</span> ${esc(s.landing.brand)}</a></header>`;

const startLink = (s: SiteStrings) => `<a class="site-start" href="/welkom">${esc(s.landing.start)}</a>`;

/** The landing page body. The start link opens the welcome screen, which also marks the learner as started. */
export function renderLanding(s: SiteStrings, guides: Guide[] = loadGuides()): string {
  const l = s.landing;
  return `<div id="landing" class="site">
      ${brandBar(s)}
      <main class="site-main">
        <section class="site-hero">
          <h1>${esc(l.heading)}</h1>
          <p class="site-tagline">${esc(l.tagline)}</p>
          ${startLink(s)}
        </section>
        <section>
          <h2>${esc(l.partsHeading)}</h2>
          <ul class="site-cards">
          ${cards(l.parts)}
          </ul>
        </section>
        <section>
          <h2>${esc(l.whyHeading)}</h2>
          <ul class="site-cards">
          ${cards(l.why)}
          </ul>
        </section>
        <section>
          <h2>${esc(l.guidesHeading)}</h2>
          ${guideCards(guides)}
        </section>
        <section class="site-faq">
          <h2>${esc(l.faqHeading)}</h2>
          ${l.faq
            // Native accordions: no script, and the closed answers are still in the HTML for search engines.
            .map((f, i) => `<details${i === 0 ? " open" : ""}>\n            <summary>${esc(f.q)}</summary>\n            <p>${md.renderInline(f.a)}</p>\n          </details>`)
            .join("\n          ")}
        </section>
        <p class="site-note">${esc(l.disclaimer)}</p>
        ${startLink(s)}
      </main>
    </div>`;
}

/** A complete page outside the app (no app code is loaded). */
function page(s: SiteStrings, head: string, main: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    ${head}
    <link rel="stylesheet" href="/site.css" />
    <meta name="theme-color" content="#e8710a" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
  </head>
  <body>
    <div class="site">
      ${brandBar(s)}
      <main class="site-main">
        ${main}
      </main>
    </div>
  </body>
</html>
`;
}

const callToAction = (s: SiteStrings) => `<aside class="site-cta">
          <h2>${esc(s.guide.ctaHeading)}</h2>
          <p>${esc(s.guide.ctaText)}</p>
          ${startLink(s)}
        </aside>`;

export function renderGuide(s: SiteStrings, guide: Guide, guides: Guide[]): string {
  const url = `${SITE_URL}${guidePath(guide)}`;
  const head = headTags(s, {
    title: guide.title,
    description: guide.description,
    path: guidePath(guide),
    ogTitle: guide.heading,
    ogType: "article",
    data: [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: guide.heading,
        description: guide.description,
        dateModified: guide.lastChecked,
        inLanguage: "en",
        mainEntityOfPage: url,
        publisher: { "@type": "Organization", name: s.meta.siteName, url: `${SITE_URL}/` },
      },
    ],
  });
  const others = guides.filter((g) => g.slug !== guide.slug);
  return page(
    s,
    head,
    `<article class="site-article">
          <h1>${esc(guide.heading)}</h1>
          <p class="site-note">${esc(s.guide.lastChecked.replace("{date}", formatDate(guide.lastChecked)))}. ${esc(s.guide.unofficial)}</p>
          ${md.render(guide.body)}
        </article>
        ${callToAction(s)}
        <nav aria-label="${esc(s.guide.more)}">
          <h2>${esc(s.guide.more)}</h2>
          ${guideCards(others)}
          <p><a href="/guides/">${esc(s.guide.allGuides)}</a></p>
        </nav>`,
  );
}

export function renderGuideIndex(s: SiteStrings, guides: Guide[]): string {
  const head = headTags(s, {
    title: s.guide.indexTitle,
    description: s.guide.indexDescription,
    path: "/guides/",
    ogTitle: s.guide.indexHeading,
    ogType: "website",
    data: [],
  });
  return page(
    s,
    head,
    `<h1>${esc(s.guide.indexHeading)}</h1>
        <p class="site-tagline">${esc(s.guide.indexIntro)}</p>
        ${guideCards(guides)}
        ${callToAction(s)}`,
  );
}

/** Every public page; app screens hold personal progress and stay out. */
export function sitemapXml(guides: Guide[] = loadGuides()): string {
  const urls = ["/", "/guides/", ...guides.map(guidePath)].map((p) => `  <url><loc>${SITE_URL}${p}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

export const robotsTxt = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;

/** Fills the <!-- landing:head --> and <!-- landing:body --> markers in index.html. */
export function fillIndexHtml(html: string, s: SiteStrings = en, guides: Guide[] = loadGuides()): string {
  for (const marker of ["<!-- landing:head -->", "<!-- landing:body -->"]) {
    if (!html.includes(marker)) throw new Error(`index.html is missing ${marker}`);
  }
  return html.replace("<!-- landing:head -->", renderHead(s)).replace("<!-- landing:body -->", renderLanding(s, guides));
}

/** Every file outside index.html, by its path in the built site. */
export function sitePages(s: SiteStrings = en, guides: Guide[] = loadGuides()): Record<string, string> {
  return {
    "guides/index.html": renderGuideIndex(s, guides),
    ...Object.fromEntries(guides.map((g) => [`guides/${g.slug}/index.html`, renderGuide(s, g, guides)])),
    "sitemap.xml": sitemapXml(guides),
    "robots.txt": robotsTxt(),
  };
}

export function sitePlugin(): Plugin {
  return {
    name: "site-pages",
    transformIndexHtml: (html) => fillIndexHtml(html),
    // In `npm run dev` the guides are rendered on request, fresh from the files.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?")[0];
        const file = url.endsWith("/") ? `${url.slice(1)}index.html` : url.slice(1);
        const pages = url.startsWith("/guides/") || url === "/sitemap.xml" || url === "/robots.txt" ? sitePages() : {};
        if (!(file in pages)) return next();
        res.setHeader("Content-Type", file.endsWith(".html") ? "text/html; charset=utf-8" : file.endsWith(".xml") ? "application/xml" : "text/plain");
        res.end(pages[file]);
      });
    },
    generateBundle() {
      for (const [fileName, source] of Object.entries(sitePages())) this.emitFile({ type: "asset", fileName, source });
    },
  };
}
