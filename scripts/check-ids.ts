import fs from "node:fs/promises";
import path from "node:path";
import { collectContentIds, missingIds } from "../shared/content/ids.js";
import { loadCourse } from "./courseFiles.js";

// Usage: npm run check-ids            (fails if an id of the baseline is gone)
//        npm run check-ids -- --update (rewrites the baseline, for adding the new ids or removing on purpose)
const BASELINE = path.resolve("data/content-ids.json");

async function main() {
  const { data, problems } = await loadCourse();
  if (problems.length) {
    console.error("De cursus is niet geldig. Draai eerst: npm run validate");
    process.exit(1);
  }
  const current = collectContentIds(data);

  if (process.argv.includes("--update")) {
    await fs.writeFile(BASELINE, JSON.stringify({ note: "Stable ids of the course. Progress files refer to these. Update with: npm run check-ids -- --update", ids: current }, null, 0) + "\n");
    console.log(`Basislijn bijgewerkt: ${current.length} ids.`);
    return;
  }

  let baseline: string[];
  try {
    baseline = JSON.parse(await fs.readFile(BASELINE, "utf-8")).ids;
  } catch {
    console.error("Geen basislijn gevonden. Maak er een met: npm run check-ids -- --update");
    process.exit(1);
  }
  const gone = missingIds(baseline, current);
  if (gone.length) {
    console.error(`${gone.length} id(s) uit de vorige versie bestaan niet meer. Voortgang van mensen kan hierdoor verloren gaan:\n${gone.slice(0, 30).map((id) => `  - ${id}`).join("\n")}${gone.length > 30 ? `\n  … en ${gone.length - 30} meer` : ""}\n\nBewust verwijderd? Draai dan: npm run check-ids -- --update`);
    process.exit(1);
  }
  const added = current.length - baseline.length;
  console.log(`Alle ${baseline.length} bekende ids bestaan nog.${added > 0 ? ` ${added} nieuw: draai "npm run check-ids -- --update" om ze vast te leggen.` : ""}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
