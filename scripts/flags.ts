import fs from "node:fs/promises";
import { loadCourse } from "./courseFiles.js";
import { collectFlags, formatFlags } from "./flagsReport.js";

// Usage: npm run flags -- <progress-file.json> [more files...]
async function main() {
  const paths = process.argv.slice(2);
  if (!paths.length) {
    console.error("Gebruik: npm run flags -- <voortgangsbestand.json> [nog een bestand...]");
    process.exit(1);
  }
  const files = await Promise.all(paths.map(async (p) => JSON.parse(await fs.readFile(p, "utf-8"))));
  const { content } = await loadCourse();
  console.log(formatFlags(collectFlags(files), content));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
