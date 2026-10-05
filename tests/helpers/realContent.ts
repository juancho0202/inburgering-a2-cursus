import fs from "node:fs/promises";
import path from "node:path";
import type { Content } from "../../shared/content/types";
import { loadContent } from "../../server/db/contentRepo";

/** The real course from data/course, for integration tests. (Step 2 replaces this with the build-time bundle.) */
export async function realContent(): Promise<Content> {
  const c = await loadContent();
  if (c.errors.length) throw new Error(`Content errors: ${JSON.stringify(c.errors.slice(0, 3))}`);
  const root = path.resolve("data/course");
  const samenvatting = await fs.readFile(path.join(root, "basis/samenvatting.md"), "utf-8");
  const facts = new Map<string, string>();
  for (const f of await fs.readdir(path.join(root, "knm/facts"))) {
    facts.set(f.replace(/\.md$/, ""), await fs.readFile(path.join(root, "knm/facts", f), "utf-8"));
  }
  return {
    course: { id: c.course!.id, title: c.course!.title },
    modules: c.modules, units: c.units, vocabByTheme: c.vocabByTheme, vocabById: c.vocabById, verbs: c.verbs, exams: c.exams,
    samenvatting, facts,
  };
}
