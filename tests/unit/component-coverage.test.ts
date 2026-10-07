// A guard against forgetting tests: every Vue component must be tested directly (a test under
// tests/unit/components imports it) or be listed below with the reason why that is not needed.
// A new component therefore fails this test until someone writes its tests or makes that call on purpose.
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(__dirname, "../..");
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });

const components = walk(path.join(root, "src")).filter((f) => f.endsWith(".vue")).map((f) => path.relative(root, f).replaceAll(path.sep, "/"));
const testSource = walk(path.join(root, "tests/unit/components")).filter((f) => f.endsWith(".test.ts")).map((f) => readFileSync(f, "utf8")).join("\n");
const importedByATest = (file: string) => testSource.includes(`/${path.basename(file)}"`);

/** Only for components with no logic of their own, or ones that are fully exercised through a parent that is tested. */
const NOT_TESTED_DIRECTLY: Record<string, string> = {
  "src/components/ui/AppButton.vue": "Styling wrapper around <button>; used (and clicked) in nearly every test.",
  "src/components/ui/SpeakButton.vue": "Thin wrapper around the browser's speech synthesis, which jsdom does not have; the voice choice lives in useSpeech.",
  "src/components/exercises/OptionButton.vue": "Presentational; its states are checked through McExercise and TrueFalseExercise.",
  "src/components/exercises/ExerciseStem.vue": "Shows the prompt and context; nothing to decide.",
  "src/components/exercises/ExerciseRenderer.vue": "Picks the component for the exercise type; covered through ExerciseShell, which renders every type via it.",
  "src/components/WritingFeedbackPanel.vue": "Display of Claude's feedback; covered through WritingExercise and ExamResultView. The correction segments are tested in logic.test.ts.",
  "src/components/KeyGuide.vue": "Static help text.",
  "src/components/AboutContent.vue": "Static text.",
  "src/views/AboutView.vue": "Static text.",
};

describe("component test coverage", () => {
  it("finds the components (so this guard cannot pass by looking in the wrong place)", () => {
    expect(components.length).toBeGreaterThan(30);
    expect(testSource.length).toBeGreaterThan(1000);
  });

  it("every component is tested directly or has a written reason in NOT_TESTED_DIRECTLY", () => {
    const missing = components.filter((c) => !importedByATest(c) && !(c in NOT_TESTED_DIRECTLY));
    expect(missing, `No component test imports these. Add tests (see tests/README.md), or add a reason to NOT_TESTED_DIRECTLY:\n${missing.join("\n")}`).toEqual([]);
  });

  it("the list of exceptions stays honest: no removed files, and nothing that is tested after all", () => {
    const stale = Object.keys(NOT_TESTED_DIRECTLY).filter((c) => !components.includes(c) || importedByATest(c));
    expect(stale, `Remove these from NOT_TESTED_DIRECTLY (deleted or now tested): ${stale.join(", ")}`).toEqual([]);
  });
});
