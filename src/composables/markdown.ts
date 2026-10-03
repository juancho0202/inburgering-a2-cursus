import MarkdownIt from "markdown-it";

const md = new MarkdownIt({ html: false, linkify: false, breaks: false });

export const renderMd = (src: string) => md.render(src);
export const renderMdInline = (src: string) => md.renderInline(src);

export const slug = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

const mdAnchors = new MarkdownIt({ html: false });
mdAnchors.renderer.rules.heading_open = (tokens, idx, opts, _env, self) => {
  const t = tokens[idx];
  if (t.tag === "h2") t.attrSet("id", slug(tokens[idx + 1].content));
  return self.renderToken(tokens, idx, opts);
};

/** Renders markdown with ids on h2 headings (for anchor links). */
export const renderMdAnchors = (src: string) => mdAnchors.render(src);
export const h2Headings = (src: string) =>
  [...src.matchAll(/^## (.+)$/gm)].map((m) => ({ title: m[1], id: slug(m[1]) }));
