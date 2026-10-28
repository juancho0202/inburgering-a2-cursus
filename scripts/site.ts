/**
 * The public pages: the landing page and the guides, plus the files search engines read (sitemap.xml, robots.txt).
 *
 * The landing page is written into index.html at build time, so search engines and first-time visitors get real
 * text without running the app. Learners who have started skip it before the first paint (public/boot.js).
 * The landing page in the app's other languages (/nl/, /es/) and the guides (/guides/) are plain HTML pages with no
 * app at all. Short copy lives in site/strings/<lang>.json; the guides are English only for now
 * (site/guides/en/<slug>.md).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import MarkdownIt from "markdown-it";
import type { Plugin } from "vite";
import en from "../site/strings/en.json";
import nl from "../site/strings/nl.json";
import es from "../site/strings/es.json";
import type { UiLanguage } from "../shared/schemas/store";
import { externalLinksInNewTab } from "../src/lib/externalLinks";

export const SITE_URL = "https://trainforinburgering.com";
const GUIDES_DIR = path.resolve(__dirname, "../site/guides/en");
const ICONS_DIR = path.resolve(__dirname, "../site/icons");

export type SiteStrings = typeof en;
/** What a landing page needs in each language (the guides' labels are English only). */
export type LandingStrings = Pick<SiteStrings, "meta" | "landing">;
type Item = { title: string; text: string };

export interface SiteLanguage {
  code: UiLanguage;
  /** In its own language, as the app's picker shows it. */
  name: string;
  path: string;
  ogLocale: string;
  strings: LandingStrings;
}

/** A landing page for every language of the app. English is the default at "/", which is also the app. */
export const SITE_LANGUAGES: SiteLanguage[] = [
  { code: "en", name: "English", path: "/", ogLocale: "en_GB", strings: en },
  { code: "nl", name: "Nederlands", path: "/nl/", ogLocale: "nl_NL", strings: nl },
  { code: "es", name: "Español", path: "/es/", ogLocale: "es_ES", strings: es },
];
const ENGLISH = SITE_LANGUAGES[0];

/** Folders of plain pages: the app's offline copy must never answer for them (vite.config.ts). */
export const STATIC_DIRS = ["guides", ...SITE_LANGUAGES.filter((l) => l.path !== "/").map((l) => l.code)];

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
  /** Picture on the guide's card: site/icons/<icon>.svg */
  icon: string;
  /** Markdown */
  body: string;
}

// html off: a guide or a translation can never put raw markup in the page. Links to other sites open in a new tab.
const md = new MarkdownIt({ html: false }).use(externalLinksInNewTab);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Inside <script type="application/ld+json">, "<" could end the block early.
const jsonLd = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;

export const guidePath = (g: Guide) => `/guides/${g.slug}/`;

const REQUIRED = ["slug", "title", "description", "heading", "lastChecked", "order", "icon"] as const;

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
  if (!/^[a-z0-9-]+$/.test(meta.icon)) throw new Error(`${file}: icon must be the name of a file in site/icons`);
  return { slug: meta.slug, title: meta.title, description: meta.description, heading: meta.heading, lastChecked: meta.lastChecked, order: Number(meta.order), icon: meta.icon, body: m[2] };
}

export function loadGuides(dir = GUIDES_DIR): Guide[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => parseGuide(f, readFileSync(path.join(dir, f), "utf8")))
    .sort((a, b) => a.order - b.order);
}

const formatDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

interface HeadOptions {
  lang: SiteLanguage;
  /** Landing pages list each other's language versions for search engines. */
  alternates?: boolean;
  title: string;
  description: string;
  path: string;
  ogTitle: string;
  ogType: "website" | "article";
  data: unknown[];
}

/** Title, description, canonical, language versions, Open Graph, share card and structured data. */
function headTags(s: LandingStrings, o: HeadOptions): string {
  const url = `${SITE_URL}${o.path}`;
  const alternates = o.alternates
    ? [
        ...SITE_LANGUAGES.map((l) => `<link rel="alternate" hreflang="${l.code}" href="${SITE_URL}${l.path}" />`),
        `<link rel="alternate" hreflang="x-default" href="${SITE_URL}/" />`,
      ]
    : [];
  return [
    `<title>${esc(o.title)}</title>`,
    `<meta name="description" content="${esc(o.description)}" />`,
    `<link rel="canonical" href="${url}" />`,
    ...alternates,
    `<meta property="og:type" content="${o.ogType}" />`,
    `<meta property="og:locale" content="${o.lang.ogLocale}" />`,
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

/** The tags for a landing page. In index.html every app screen shares them, so they all point to "/". */
export function renderHead(lang: SiteLanguage = ENGLISH): string {
  const s = lang.strings;
  const url = `${SITE_URL}${lang.path}`;
  return headTags(s, {
    lang,
    alternates: true,
    title: s.meta.title,
    description: s.meta.description,
    path: lang.path,
    ogTitle: s.meta.ogTitle,
    ogType: "website",
    data: [
      { "@context": "https://schema.org", "@type": "WebSite", name: s.meta.siteName, alternateName: "TrainForInburgering", url: `${SITE_URL}/` },
      {
        "@context": "https://schema.org",
        "@type": "WebApplication",
        name: s.meta.siteName,
        url,
        description: s.meta.description,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Any (web browser)",
        inLanguage: lang.code,
        offers: { "@type": "Offer", price: "0", priceCurrency: "EUR" },
      },
    ],
  });
}

const cards = (items: Item[]) =>
  items.map((i) => `<li class="site-card"><h3>${esc(i.title)}</h3><p>${esc(i.text)}</p></li>`).join("\n          ");

/**
 * A card picture, inlined so its colours follow the page theme (site.css). Decorative: the title says it all.
 * No ids (a page shows several) and no style attributes (the security policy blocks inline styles).
 */
export function guideIcon(name: string, dir = ICONS_DIR): string {
  const file = path.join(dir, `${name}.svg`);
  if (!existsSync(file)) throw new Error(`site/icons/${name}.svg does not exist`);
  return readFileSync(file, "utf8")
    .replace(/<!--[\s\S]*?-->\s*/g, "")
    .replace(/\s*\n\s*/g, "")
    .replace("<svg ", '<svg class="site-guide-icon" aria-hidden="true" focusable="false" ');
}

/**
 * Guides as cards: picture on the left, text on the right. The link is the title; a stretched ::after makes the whole
 * card clickable. On a page in another language the (English) cards say so, for screen readers and translators.
 */
const guideCards = (guides: Guide[], pageLang: UiLanguage = "en") =>
  `<ul class="site-cards site-cards-wide"${pageLang === "en" ? "" : ' lang="en"'}>
          ${guides
            .map((g) => `<li class="site-card site-card-link site-card-guide">${guideIcon(g.icon)}<h3><a href="${guidePath(g)}">${esc(g.heading)}</a></h3><p>${esc(g.description)}</p></li>`)
            .join("\n          ")}
          </ul>`;

const GLOBE =
  '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>';

/** The language menu: a native <details>, so it needs no script. Each language is named in its own language. */
export function languageMenu(current: SiteLanguage): string {
  const label = `${current.strings.landing.language}: ${current.name}`;
  const items = SITE_LANGUAGES.map(
    (l) => `<li><a href="${l.path}" hreflang="${l.code}" lang="${l.code}"${l === current ? ' aria-current="page"' : ""}>${esc(l.name)}</a></li>`,
  );
  return `<details class="site-lang">
          <summary>${GLOBE}<span class="site-sr">${esc(label)}</span><span class="site-lang-name" aria-hidden="true">${esc(current.name)}</span><span class="site-lang-code" aria-hidden="true">${current.code.toUpperCase()}</span></summary>
          <ul>
            ${items.join("\n            ")}
          </ul>
        </details>`;
}

const brandBar = (s: LandingStrings, home = "/", menu = "") =>
  `<header class="site-top"><a href="${home}" class="site-brand"><span class="site-logo" aria-hidden="true">NL</span> ${esc(s.landing.brand)}</a>${menu}</header>`;

/**
 * Into the app. A page in one language passes it on, to preselect the first-visit picker (a language the learner
 * already chose wins). "/" is also every visitor's default page, so from there the app follows the browser's language.
 */
const startLink = (lang: SiteLanguage) =>
  `<a class="site-start" href="${lang.path === "/" ? "/welkom" : `/?lang=${lang.code}`}">${esc(lang.strings.landing.start)}</a>`;

/** The landing page body, in one of the app's languages. */
export function renderLanding(lang: SiteLanguage = ENGLISH, guides: Guide[] = loadGuides()): string {
  const l = lang.strings.landing;
  return `<div id="landing" class="site">
      ${brandBar(lang.strings, lang.path, languageMenu(lang))}
      <main class="site-main">
        <section class="site-hero">
          <h1>${esc(l.heading)}</h1>
          <p class="site-tagline">${esc(l.tagline)}</p>
          ${startLink(lang)}
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
          ${l.guidesNote ? `<p class="site-section-note">${esc(l.guidesNote)}</p>` : ""}
          ${guideCards(guides, lang.code)}
        </section>
        <section class="site-faq">
          <h2>${esc(l.faqHeading)}</h2>
          ${l.faq
            // Native accordions: no script, and the closed answers are still in the HTML for search engines.
            .map((f, i) => `<details${i === 0 ? " open" : ""}>\n            <summary>${esc(f.q)}</summary>\n            <p>${md.renderInline(f.a)}</p>\n          </details>`)
            .join("\n          ")}
        </section>
        <p class="site-note">${esc(l.disclaimer)}</p>
        ${startLink(lang)}
      </main>
    </div>`;
}

const DOC_HEAD = `<meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />`;
const DOC_LINKS = `<link rel="stylesheet" href="/site.css" />
    <meta name="theme-color" content="#e8710a" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />`;

/** The landing page in another language: a page of its own, without the app (its start link opens the app). */
export function renderLandingPage(lang: SiteLanguage, guides: Guide[] = loadGuides()): string {
  return `<!doctype html>
<html lang="${lang.code}">
  <head>
    ${DOC_HEAD}
    ${renderHead(lang)}
    ${DOC_LINKS}
  </head>
  <body>
    ${renderLanding(lang, guides)}
  </body>
</html>
`;
}

/** A guide page (English, no app code is loaded). */
function page(s: SiteStrings, head: string, main: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    ${DOC_HEAD}
    ${head}
    ${DOC_LINKS}
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
          ${startLink(ENGLISH)}
        </aside>`;

export function renderGuide(s: SiteStrings, guide: Guide, guides: Guide[]): string {
  const url = `${SITE_URL}${guidePath(guide)}`;
  const head = headTags(s, {
    lang: ENGLISH,
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
    lang: ENGLISH,
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
  const urls = [...SITE_LANGUAGES.map((l) => l.path), "/guides/", ...guides.map(guidePath)].map((p) => `  <url><loc>${SITE_URL}${p}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
}

export const robotsTxt = () => `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`;

/** Fills the <!-- landing:head --> and <!-- landing:body --> markers in index.html. */
export function fillIndexHtml(html: string, lang: SiteLanguage = ENGLISH, guides: Guide[] = loadGuides()): string {
  for (const marker of ["<!-- landing:head -->", "<!-- landing:body -->"]) {
    if (!html.includes(marker)) throw new Error(`index.html is missing ${marker}`);
  }
  return html.replace("<!-- landing:head -->", renderHead(lang)).replace("<!-- landing:body -->", renderLanding(lang, guides));
}

/** Every file outside index.html, by its path in the built site. */
export function sitePages(s: SiteStrings = en, guides: Guide[] = loadGuides()): Record<string, string> {
  return {
    ...Object.fromEntries(SITE_LANGUAGES.filter((l) => l.path !== "/").map((l) => [`${l.code}/index.html`, renderLandingPage(l, guides)])),
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
    // In `npm run dev` the plain pages are rendered on request, fresh from the files.
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = (req.url ?? "").split("?")[0];
        const file = url.endsWith("/") ? `${url.slice(1)}index.html` : url.slice(1);
        const isSitePage = STATIC_DIRS.some((d) => url.startsWith(`/${d}/`)) || url === "/sitemap.xml" || url === "/robots.txt";
        const pages = isSitePage ? sitePages() : {};
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
