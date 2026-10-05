import { loadCourse } from "./courseFiles.js";

async function main() {
  const { problems } = await loadCourse();
  if (problems.length > 0) {
    console.error(`Validatie mislukt: ${problems.length} fout(en)\n`);
    for (const p of problems) console.error(`- ${p}`);
    process.exit(1);
  }
  console.log("Alle content is geldig.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
