import type { ContentData, ContentError } from "./data.js";

/**
 * Checks on top of the schemas: unique ids, references that exist, answer indexes, exam rules.
 * Returns readable (Dutch) messages; an empty list means the course is valid.
 */
export function validateContent(data: ContentData, parseErrors: ContentError[] = []): string[] {
  const errors: string[] = parseErrors.map((e) => `${e.file}\n  ${e.message}`);
  const add = (msg: string) => errors.push(msg);

  const vocabIds = new Set(data.vocab.flatMap((v) => v.entries.map((e) => e.id)));
  const verbIds = new Set(data.verbs.map((v) => v.id));
  const unitIds = new Set(data.units.map((u) => u.id));

  const allIds = new Set<string>();
  const addId = (id: string, where: string) => {
    if (allIds.has(id)) add(`Dubbel id "${id}" gevonden (${where})`);
    allIds.add(id);
  };

  for (const mod of data.modules) {
    addId(mod.id, "modules");
    for (const id of mod.units) if (!unitIds.has(id)) add(`Module "${mod.id}" noemt de les "${id}", maar die bestaat niet`);
  }

  for (const unit of data.units) {
    addId(unit.id, "units");
    for (const step of unit.steps) {
      if (step.type !== "exercise") continue;
      const ex = step.exercise;
      addId(ex.id, unit.id);
      if (!ex.explanation.trim()) add(`Lege explanation bij ${ex.id}`);
      if ((ex.type === "mc" || ex.type === "mc-multi") && new Set(ex.options).size !== ex.options.length) add(`Dubbele opties bij ${ex.id}`);
      if (ex.type === "mc" && (ex.answer < 0 || ex.answer >= ex.options.length)) add(`Ongeldig answer-index bij ${ex.id}`);
      if (ex.type === "word-order" && ex.tokens.length === 0) add(`Lege tokens bij ${ex.id}`);
      if (ex.type === "conjugate" && !verbIds.has(ex.verbId)) add(`verbId "${ex.verbId}" bestaat niet (${ex.id})`);
      if (ex.type === "mc-multi" && ex.answers.some((a) => a < 0 || a >= ex.options.length)) add(`Ongeldig answers-index bij ${ex.id}`);
      if (ex.type === "gap-choice" && (ex.answers.length !== ex.options.length || ex.answers.some((a, i) => a >= ex.options[i].length))) {
        add(`answers/options kloppen niet bij ${ex.id}`);
      }
      if (ex.type === "reading") {
        for (const q of ex.questions) {
          addId(q.id, unit.id);
          if (q.type === "mc" && new Set(q.options).size !== q.options.length) add(`Dubbele opties bij ${q.id}`);
          if (q.type === "mc" && (q.answer < 0 || q.answer >= q.options.length)) add(`Ongeldig answer-index bij ${q.id}`);
        }
      }
      if (ex.type === "writing") {
        const n = ex.task.requiredPoints.length;
        if (n < 2 || n > 4) add(`requiredPoints moet 2-4 zijn bij ${ex.id}`);
      }
    }
    for (const ref of unit.vocabRefs) {
      if (!vocabIds.has(ref) && !verbIds.has(ref)) add(`vocabRef "${ref}" bestaat niet (${unit.id})`);
    }
  }

  for (const file of data.vocab) for (const entry of file.entries) addId(entry.id, "vocab");
  for (const verb of data.verbs) addId(verb.id, "verbs");

  for (const exam of data.exams) {
    addId(exam.id, "exams");
    for (const item of exam.items) {
      if ("ref" in item) {
        add(`Examen ${exam.id}: gebruik geen ref; teksten en vragen mogen niet uit de lessen komen (${item.ref})`);
        continue;
      }
      addId(item.id, exam.id);
      if (!item.explanation.trim()) add(`Lege explanation bij ${item.id}`);
      const questions = item.type === "reading" ? item.questions : [item];
      for (const q of questions) {
        if (q !== item) addId(q.id, exam.id);
        if (q.type === "mc" && (q.answer < 0 || q.answer >= q.options.length)) add(`Ongeldig answer-index bij ${q.id}`);
        if (q.type === "mc" && new Set(q.options).size !== q.options.length) add(`Dubbele opties bij ${q.id}`);
      }
      if (exam.skill !== "schrijven" && item.type !== "mc" && item.type !== "reading") add(`${item.id}: alleen meerkeuze en leestekst in een ${exam.skill}-examen`);
      if (exam.skill === "schrijven" && item.type !== "form-fill" && item.type !== "writing") add(`${item.id}: alleen formulier en schrijfopdracht in een schrijfexamen`);
    }
    if (exam.skill === "knm" && exam.items.length !== 40) add(`${exam.id}: een KNM-examen heeft 40 vragen (nu ${exam.items.length})`);
    if (exam.skill === "schrijven" && exam.items.length !== 4) add(`${exam.id}: een schrijfexamen heeft 4 opdrachten (nu ${exam.items.length})`);
  }

  return errors;
}
