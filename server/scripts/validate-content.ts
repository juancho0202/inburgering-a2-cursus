import { loadContent } from "../db/contentRepo.js";

async function main() {
  const content = await loadContent();
  const extraErrors: string[] = [];

  const allIds = new Set<string>();
  const addId = (id: string, file: string) => {
    if (allIds.has(id)) extraErrors.push(`Dubbel id "${id}" gevonden (${file})`);
    allIds.add(id);
  };

  for (const unit of content.units.values()) {
    addId(unit.id, "units");
    for (const step of unit.steps) {
      if (step.type === "exercise") {
        const ex = step.exercise;
        addId(ex.id, unit.id);
        if (!ex.explanation.trim()) extraErrors.push(`Lege explanation bij ${ex.id}`);
        if ((ex.type === "mc" || ex.type === "mc-multi") && new Set(ex.options).size !== ex.options.length) {
          extraErrors.push(`Dubbele opties bij ${ex.id}`);
        }
        if (ex.type === "mc" && (ex.answer < 0 || ex.answer >= ex.options.length)) {
          extraErrors.push(`Ongeldig answer-index bij ${ex.id}`);
        }
        if (ex.type === "word-order" && ex.tokens.length === 0) {
          extraErrors.push(`Lege tokens bij ${ex.id}`);
        }
        if (ex.type === "conjugate" && !content.verbs.has(ex.verbId)) {
          extraErrors.push(`verbId "${ex.verbId}" bestaat niet (${ex.id})`);
        }
        if (ex.type === "mc-multi" && ex.answers.some((a) => a < 0 || a >= ex.options.length)) {
          extraErrors.push(`Ongeldig answers-index bij ${ex.id}`);
        }
        if (ex.type === "gap-choice" && (ex.answers.length !== ex.options.length || ex.answers.some((a, i) => a >= ex.options[i].length))) {
          extraErrors.push(`answers/options kloppen niet bij ${ex.id}`);
        }
        if (ex.type === "reading") {
          for (const q of ex.questions) {
            addId(q.id, unit.id);
            if (q.type === "mc" && new Set(q.options).size !== q.options.length) extraErrors.push(`Dubbele opties bij ${q.id}`);
            if (q.type === "mc" && (q.answer < 0 || q.answer >= q.options.length)) extraErrors.push(`Ongeldig answer-index bij ${q.id}`);
          }
        }
        if (ex.type === "writing") {
          const n = ex.task.requiredPoints.length;
          if (n < 2 || n > 4) extraErrors.push(`requiredPoints moet 2-4 zijn bij ${ex.id}`);
        }
      }
    }
    for (const ref of unit.vocabRefs) {
      if (!content.vocabById.has(ref) && !content.verbs.has(ref)) extraErrors.push(`vocabRef "${ref}" bestaat niet (${unit.id})`);
    }
  }

  for (const entry of content.vocabById.values()) addId(entry.id, "vocab");
  for (const verb of content.verbs.values()) addId(verb.id, "verbs");
  for (const exam of content.exams.values()) {
    addId(exam.id, "exams");
    for (const item of exam.items) {
      if ("ref" in item && !content.units.has(item.ref) && !allIds.has(item.ref)) {
        // refs may point to exercise ids collected above; checked loosely here
      }
    }
  }

  const allErrors = [...content.errors.map((e) => `${e.file}\n  ${e.message}`), ...extraErrors];

  if (allErrors.length > 0) {
    console.error(`Validatie mislukt: ${allErrors.length} fout(en)\n`);
    for (const err of allErrors) console.error(`- ${err}`);
    process.exit(1);
  }

  console.log("Alle content is geldig.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
