import { loadContent } from "../db/contentRepo.js";

const TARGETS = {
  vocab: 500,
  verbs: 80,
  basisExercises: 250,
  lezenTexts: 30,
  lezenQuestions: 120,
  knmQuestions: 200,
  schrijvenTasks: 16,
};

async function main() {
  const content = await loadContent();

  let basisExercises = 0;
  let lezenTexts = 0;
  let lezenQuestions = 0;
  let knmQuestions = 0;
  let schrijvenTasks = 0;
  let formFill = 0;

  for (const unit of content.units.values()) {
    for (const step of unit.steps) {
      if (step.type !== "exercise") continue;
      const ex = step.exercise;
      if (unit.moduleId === "basis") basisExercises += 1;
      if (unit.moduleId === "knm") knmQuestions += 1;
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

  console.log(line("Vocab entries", content.vocabById.size, TARGETS.vocab));
  console.log(line("Verbs", content.verbs.size, TARGETS.verbs));
  console.log(line("Basis exercises", basisExercises, TARGETS.basisExercises));
  console.log(line("Lezen teksten", lezenTexts, TARGETS.lezenTexts));
  console.log(line("Lezen vragen", lezenQuestions, TARGETS.lezenQuestions));
  console.log(line("KNM vragen", knmQuestions, TARGETS.knmQuestions));
  console.log(line("Schrijven taken", schrijvenTasks, TARGETS.schrijvenTasks));
  console.log(`    Form-fill oefeningen: ${formFill}`);
  console.log(`    Mock exams: ${content.exams.size}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
