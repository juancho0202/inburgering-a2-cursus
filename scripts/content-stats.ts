import { loadCourse } from "./courseFiles.js";

const TARGETS = {
  vocab: 500,
  verbs: 80,
  basisExercises: 250,
  lezenTexts: 30,
  lezenQuestions: 120,
  synonymPairs: 40,
  knmQuestions: 200,
  knmPerTheme: 25,
  schrijvenTasks: 16,
  formFill: 5,
};

const KNM_THEMES = ["knm-werk", "knm-omgang", "knm-wonen", "knm-gezondheid", "knm-geschiedenis", "knm-instanties", "knm-staat", "knm-onderwijs"];

async function main() {
  const { content, data } = await loadCourse();

  let basisExercises = 0;
  let lezenTexts = 0;
  let lezenQuestions = 0;
  let synonymPairs = 0;
  let knmQuestions = 0;
  let schrijvenTasks = 0;
  let formFill = 0;
  const perTheme = new Map<string, number>();
  const perUnit = new Map<string, number>();

  for (const unit of content.units.values()) {
    if (unit.id === "basis-demo") continue;
    for (const step of unit.steps) {
      if (step.type !== "exercise") continue;
      const ex = step.exercise;
      perUnit.set(unit.id, (perUnit.get(unit.id) ?? 0) + 1);
      if (unit.moduleId === "basis") basisExercises += 1;
      if (unit.moduleId === "knm") {
        knmQuestions += 1;
        perTheme.set(unit.id, (perTheme.get(unit.id) ?? 0) + 1);
      }
      if (unit.id === "lezen-strategie" && ex.type === "match") synonymPairs += ex.pairs.length;
      if (ex.type === "reading") {
        lezenTexts += 1;
        lezenQuestions += ex.questions.length;
      }
      if (ex.type === "writing") schrijvenTasks += 1;
      if (ex.type === "form-fill") formFill += 1;
    }
  }

  const line = (label: string, actual: number, target: number) =>
    `${actual >= target ? "OK " : "!! "}${label}: ${actual} (doel: ${target})`;

  console.log(`    Course version: ${data.version}`);
  console.log(line("Vocab entries", content.vocabById.size, TARGETS.vocab));
  console.log(line("Verbs", content.verbs.size, TARGETS.verbs));
  console.log(line("Basis exercises", basisExercises, TARGETS.basisExercises));
  console.log(line("Lezen teksten", lezenTexts, TARGETS.lezenTexts));
  console.log(line("Lezen vragen", lezenQuestions, TARGETS.lezenQuestions));
  console.log(line("Lezen synoniemenparen", synonymPairs, TARGETS.synonymPairs));
  console.log(line("KNM vragen", knmQuestions, TARGETS.knmQuestions));
  for (const id of KNM_THEMES) console.log("  " + line(id, perTheme.get(id) ?? 0, TARGETS.knmPerTheme));
  console.log(line("Schrijven taken", schrijvenTasks, TARGETS.schrijvenTasks));
  console.log(line("Form-fill oefeningen", formFill, TARGETS.formFill));
  const bySkill = (skill: string) => [...content.exams.values()].filter((e) => e.skill === skill).length;
  console.log(`${bySkill("lezen") >= 2 && bySkill("knm") >= 2 && bySkill("schrijven") >= 2 ? "OK " : "!! "}Proefexamens: ${bySkill("lezen")} Lezen, ${bySkill("knm")} KNM, ${bySkill("schrijven")} Schrijven (doel: 2 / 2 / 2)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
