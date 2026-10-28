import type MarkdownIt from "markdown-it";

/**
 * Links to other websites open in a new tab, so the learner never loses their place in the app (or on our pages).
 * Our own links are always relative ("/guides/…"), so every absolute http(s) link is another site.
 */
export const isExternal = (href: string) => /^https?:\/\//i.test(href.trim());

export const NEW_TAB = { target: "_blank", rel: "noopener noreferrer" } as const;

/** markdown-it plugin: external links get target="_blank" and rel="noopener noreferrer". */
export function externalLinksInNewTab(md: MarkdownIt) {
  const render = md.renderer.rules.link_open ?? ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
    const token = tokens[idx];
    if (isExternal(token.attrGet("href") ?? "")) {
      token.attrSet("target", NEW_TAB.target);
      token.attrSet("rel", NEW_TAB.rel);
    }
    return render(tokens, idx, opts, env, self);
  };
}
