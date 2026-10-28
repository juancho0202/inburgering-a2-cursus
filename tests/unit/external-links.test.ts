// Links to other websites open in a new tab everywhere: in Markdown (app text, lessons, the public pages) and in
// the app's own templates.
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderMd, renderMdAnchors, renderMdInline } from "../../src/composables/markdown";
import { isExternal } from "../../src/lib/externalLinks";

const NEW_TAB = 'target="_blank" rel="noopener noreferrer"';

describe("Markdown links", () => {
  for (const [name, render] of [["renderMd", renderMd], ["renderMdInline", renderMdInline], ["renderMdAnchors", renderMdAnchors]] as const) {
    it(`${name}: another site opens in a new tab, a page of the app does not`, () => {
      expect(render("See [DUO](https://www.inburgeren.nl/en/).")).toContain(`<a href="https://www.inburgeren.nl/en/" ${NEW_TAB}>DUO</a>`);
      expect(render("Go to [words](/woorden).")).toContain('<a href="/woorden">words</a>');
    });
  }

  it("only absolute http(s) links count as another site", () => {
    expect(["https://duo.nl", "HTTP://x.nl", " https://x.nl"].map(isExternal)).toEqual([true, true, true]);
    expect(["/guides/", "#top", "mailto:a@b.nl", "javascript:x()"].map(isExternal)).toEqual([false, false, false, false]);
  });
});

describe("app templates", () => {
  const root = path.resolve(__dirname, "../../src");
  const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(path.join(dir, f)).isDirectory() ? walk(path.join(dir, f)) : [path.join(dir, f)]));

  it("every <a> with a fixed link to another site opens it in a new tab", () => {
    const missing: string[] = [];
    for (const file of walk(root).filter((f) => f.endsWith(".vue"))) {
      for (const tag of readFileSync(file, "utf8").match(/<a\s[^>]*href="https?:[^>]*>/g) ?? []) {
        if (!tag.includes(NEW_TAB)) missing.push(`${path.relative(root, file)}: ${tag}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
