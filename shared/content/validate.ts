import type { Fragment } from "../schemas/content.js";
import type { Exercise } from "../types.js";
import type { ContentData, ContentError } from "./data.js";
import { hasQuestions } from "./questions.js";

/** The illustrations that exist (ids of src/assets/scenes and src/assets/spots). */
export interface PictureIds {
  scenes: Set<string>;
  spots: Set<string>;
}

/**
 * Checks on top of the schemas: unique ids, references that exist, answer indexes, listening fragments, exam rules.
 * With `pictures`, also that every scene and spot a lesson names exists.
 * Returns readable (Dutch) messages; an empty list means the course is valid.
 */
export function validateContent(data: ContentData, parseErrors: ContentError[] = [], pictures?: PictureIds): string[] {
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

  const checkScene = (scene: string, where: string) => {
    if (pictures && !pictures.scenes.has(scene)) add(`Illustratie "${scene}" bestaat niet (${where}); zie src/assets/scenes`);
  };
  const checkSpot = (spot: string | undefined, where: string) => {
    if (spot && pictures && !pictures.spots.has(spot)) add(`Tekening "${spot}" bestaat niet (${where}); zie src/assets/spots`);
  };
  const checkMc = (q: Exercise) => {
    if ((q.type === "mc" || q.type === "mc-multi") && new Set(q.options).size !== q.options.length) add(`Dubbele opties bij ${q.id}`);
    if (q.type === "mc" && (q.answer < 0 || q.answer >= q.options.length)) add(`Ongeldig answer-index bij ${q.id}`);
  };
  const checkFragment = (f: Fragment, where: string) => {
    if (f.scene) checkScene(f.scene, where);
    const names = f.speakers.map((s) => s.name);
    if (new Set(names).size !== names.length) add(`Twee sprekers met dezelfde naam (${where})`);
    // With the same voice the learner cannot hear who is talking.
    if (new Set(f.speakers.map((s) => s.voice)).size !== f.speakers.length) add(`Twee sprekers met dezelfde stem (${where})`);
    f.lines.forEach((l, i) => {
      if (!names.includes(l.speaker)) add(`Regel ${i + 1} heeft spreker "${l.speaker}", maar die staat niet bij speakers (${where})`);
      if (!l.nl.trim()) add(`Regel ${i + 1} is leeg (${where})`);
    });
    for (const n of names) if (!f.lines.some((l) => l.speaker === n)) add(`Spreker "${n}" zegt niets (${where})`);
  };
  /** A listening exercise: multiple-choice questions, each pointing at the line where its answer is said. */
  const checkListening = (ex: Extract<Exercise, { type: "listening" }>) => {
    checkFragment(ex.fragment, ex.id);
    for (const q of ex.questions) {
      if (q.type !== "mc") add(`${q.id}: bij een luisterfragment horen alleen meerkeuzevragen`);
      if (q.answerLine === undefined) add(`${q.id}: answerLine ontbreekt (de regel waar het antwoord staat)`);
      else if (q.answerLine >= ex.fragment.lines.length) add(`${q.id}: answerLine ${q.answerLine} bestaat niet (het fragment heeft ${ex.fragment.lines.length} regels)`);
    }
  };

  for (const unit of data.units) {
    addId(unit.id, "units");
    if (unit.scene) checkScene(unit.scene, unit.id);
    for (const step of unit.steps) {
      if (step.type === "lesson") {
        for (const block of step.blocks) {
          if (block.kind === "picture") checkScene(block.scene, step.id);
          if (block.kind === "fragment") checkFragment(block.fragment, step.id);
        }
        continue;
      }
      const ex = step.exercise;
      checkSpot(ex.spot, ex.id);
      addId(ex.id, unit.id);
      if (!ex.explanation.trim()) add(`Lege explanation bij ${ex.id}`);
      checkMc(ex);
      if (ex.type === "word-order" && ex.tokens.length === 0) add(`Lege tokens bij ${ex.id}`);
      if (ex.type === "conjugate" && !verbIds.has(ex.verbId)) add(`verbId "${ex.verbId}" bestaat niet (${ex.id})`);
      if (ex.type === "mc-multi" && ex.answers.some((a) => a < 0 || a >= ex.options.length)) add(`Ongeldig answers-index bij ${ex.id}`);
      if (ex.type === "gap-choice" && (ex.answers.length !== ex.options.length || ex.answers.some((a, i) => a >= ex.options[i].length))) {
        add(`answers/options kloppen niet bij ${ex.id}`);
      }
      if (hasQuestions(ex)) {
        for (const q of ex.questions) {
          addId(q.id, unit.id);
          checkMc(q);
        }
      }
      if (ex.type === "listening") checkListening(ex);
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
      checkSpot(item.spot, item.id);
      if (!item.explanation.trim()) add(`Lege explanation bij ${item.id}`);
      const questions = hasQuestions(item) ? item.questions : [item];
      for (const q of questions) {
        if (q !== item) addId(q.id, exam.id);
        checkMc(q);
      }
      if (item.type === "listening") checkListening(item);
      if ((exam.skill === "lezen" || exam.skill === "knm") && item.type !== "mc" && item.type !== "reading") add(`${item.id}: alleen meerkeuze en leestekst in een ${exam.skill}-examen`);
      if (exam.skill === "luisteren" && item.type !== "listening") add(`${item.id}: alleen luisterfragmenten in een luisterexamen`);
      if (exam.skill === "schrijven" && item.type !== "form-fill" && item.type !== "writing") add(`${item.id}: alleen formulier en schrijfopdracht in een schrijfexamen`);
    }
    if (exam.skill === "knm" && exam.items.length !== 40) add(`${exam.id}: een KNM-examen heeft 40 vragen (nu ${exam.items.length})`);
    if (exam.skill === "luisteren") {
      const n = exam.items.reduce((sum, item) => sum + ("type" in item && hasQuestions(item) ? item.questions.length : 0), 0);
      if (n !== 25) add(`${exam.id}: een luisterexamen heeft 25 vragen (nu ${n})`);
    }
    if (exam.skill === "schrijven" && exam.items.length !== 4) add(`${exam.id}: een schrijfexamen heeft 4 opdrachten (nu ${exam.items.length})`);
  }

  return errors;
}
