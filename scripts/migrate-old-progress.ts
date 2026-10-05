import fs from "node:fs/promises";
import path from "node:path";
import { convertLegacyExport } from "../shared/services/transfer.js";

/**
 * Turns the data/user folder of the old (server) version into a progress file that the app can import
 * ("Ga verder met een bestand"). Usage: npm run migrate-old-progress -- [map] [uitvoerbestand]
 */
async function readJson(file: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await fs.readFile(file, "utf-8"));
  } catch {
    return undefined;
  }
}

async function readJsonl(file: string): Promise<unknown[]> {
  try {
    return (await fs.readFile(file, "utf-8"))
      .split("\n")
      .filter(Boolean)
      .flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

async function main() {
  const dir = path.resolve(process.argv[2] ?? "data/user");
  const out = path.resolve(process.argv[3] ?? "inburgering-a2-voortgang-oude-versie.json");
  const progress = await readJson(path.join(dir, "progress.json"));
  if (!progress) {
    console.error(`Geen progress.json gevonden in ${dir}. Gebruik: npm run migrate-old-progress -- <map met je oude gegevens> [uitvoerbestand]`);
    process.exit(1);
  }
  const files: Record<string, unknown> = { "progress.json": progress, "attempts.jsonl": await readJsonl(path.join(dir, "attempts.jsonl")) };
  for (const name of ["srs.json", "writing.json", "explanations.json", "settings.json"]) {
    const data = await readJson(path.join(dir, name));
    if (data !== undefined) files[name] = data;
  }
  const converted = convertLegacyExport({ exportedAt: new Date().toISOString(), files });
  await fs.writeFile(out, JSON.stringify(converted));
  const d = converted.data;
  console.log(`Klaar: ${out}\n  ${d.attempts.length} antwoorden, ${d.units.length} lessen, ${d.srsCards.length} woordkaartjes, ${d.writing.length} teksten, ${d.examResults.length} examens.\nDe API-sleutel is niet meegenomen. Kies dit bestand in de app bij “Ga verder met een bestand”.`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
