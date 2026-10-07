# Testing guide (for people and for agents)

Read this before you add, change or review a component, a view, a store or anything a learner can see or click.
The short version is in `CLAUDE.md`.

## The three layers

| Layer | Where | What belongs there | Run |
| --- | --- | --- | --- |
| Logic | `tests/unit/*.test.ts` | Pure code in `shared/` (answer checking, SRS, exam grading, services, store). No DOM. | `npm test` |
| **Component** | `tests/unit/components/*.test.ts` | What a learner sees and does in one screen or widget, with the API faked. | `npm test` |
| Browser (e2e) | `tests/e2e/*.spec.ts` | A few whole journeys on the real built app (resume after refresh, file transfer, CSP). | `npm run e2e` |

Put a test in the cheapest layer that can fail for the reason you care about. A rule about *how an answer is judged*
is a logic test. A rule about *what the screen does with it* is a component test. Don't add e2e tests for things a
component test can show; e2e is slow and should stay a short list of journeys.

## What a meaningful component test is

A test is worth keeping only if **a realistic mistake in the code would make it fail** and **its failure tells you what broke for the learner**.

- Test behaviour a learner can notice: what is shown, what becomes enabled/disabled, what is saved (which API call, with what body), where they end up, what the keyboard does.
- Drive the screen the way a person does: click buttons by their visible text, type in inputs, press keys. Don't reach into component internals (`wrapper.vm.someRef`) except through what the component deliberately exposes (`ready` / `evaluate` of an exercise).
- One behaviour per test, named as a sentence that says the rule: `"exactly the pass mark is a pass"`, not `"test passScore"`.
- Assert the outcome, not the markup: text, `aria-*`, `disabled`, API calls, route. Not CSS classes (unless a class *is* the behaviour, e.g. red word counter), not snapshots, not element counts that only describe layout.
- Fake only the edge of the app: the API client (`fakeApi`), the browser (timers, `matchMedia`, storage), and heavy children that have their own tests (stub them). Use the real router, real pinia and real child components otherwise.

Do **not** write: snapshot tests, "renders without crashing" tests, tests that restate the template (`expect(text).toContain("Opslaan")` for a static label), tests of third-party code (Vue, vue-router), or one test per prop.

### Prove the test can fail

Before you trust a new test, break the code on purpose and watch it go red (mutation check):

```bash
# example: remove a guard, run the file, restore
cp src/views/UnitView.vue /tmp/x.bak
sed -i 's/if (finishing) return;//' src/views/UnitView.vue
npx vitest run tests/unit/components/UnitView.test.ts   # must fail
cp /tmp/x.bak src/views/UnitView.vue
```

If the test still passes, either it doesn't test that line (fix the test) or the line is redundant (say so in a comment or delete the line).
Try at least: inverting a condition, removing a guard or a `try/catch`, removing a cleanup (`removeEventListener`, `clearInterval`), changing a boundary (`>=` → `>`).

## Writing one

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import MyView from "../../../src/views/MyView.vue";
import { clickButton, fakeApi, mountApp } from "../../helpers/component";

vi.mock("../../../src/api/client", async () => {           // always exactly this
  const h = await import("../../helpers/component");
  return { api: h.fakeApi.api, ApiRequestError: h.ApiRequestError };
});

beforeEach(() => {
  fakeApi.reset();
  fakeApi.on("GET", "/thing", { id: 1 });                    // every endpoint the screen calls
});

it("saves the answer and moves on", async () => {
  const { wrapper, router } = await mountApp(MyView, { routePath: "/thing/:id", url: "/thing/7" });
  await clickButton(wrapper, "Opslaan");
  expect(fakeApi.to("POST", "/thing/7/save")[0].body).toEqual({ ok: true });
  expect(router.currentRoute.value.path).toBe("/");
});
```

Helpers in `tests/helpers/component.ts`:

- `fakeApi.on(method, pathOrRegExp, reply | (body, path) => reply)` registers an endpoint. **Calls to anything unregistered reject with "Unexpected API call"**, so a screen cannot quietly start talking to a new endpoint. The newest registration wins.
- `fakeApi.fail(method, path, message)` makes an endpoint fail like the real client does. `fakeApi.to(method, path)` lists the calls made (with bodies). `deferred()` holds a call open so you can test what happens meanwhile.
- `mountApp(Component, { props })` for a widget; `mountApp(View, { routePath: "/unit/:id", url: "/unit/a" })` to render it through `<RouterView/>` exactly as the app does (needed whenever the route matters). It returns `{ wrapper, router, pinia }`. `routes` replaces the route table (app shell tests, `meta`). `stubs` stubs children.
- `clickButton(wrapper, "text")` clicks a button by visible text and fails with the list of buttons if it isn't there. `pressKey("Enter")` presses a key on `window`.
- Components are attached to `document.body` and unmounted after every test.

Data in tests must be realistic: use shapes the real content has (e.g. vocabulary `nl` includes the article, `"de huur"`), and schema-valid objects wherever a component renders them (an empty `{}` as "feedback" crashes the panel and hides the real test).

## Hunting for bugs: what to look for in every screen

These are the kinds of bugs that have actually been found here. For each component you touch, ask the question and write a test when the answer is "that can happen".

1. **Same component, new route param.** Vue Router reuses a component when only `:id` or the query changes (`/unit/a` → `/unit/b`). State set in `onMounted` goes stale. Test by navigating with `router.push` inside `mountApp(..., { routePath })`. (Fixed in `UnitView`. `PracticeView` also loads only in `onMounted`; in the UI it is entered from other pages, so it is only exposed through browser back/forward between two practice URLs.)
2. **Double trigger.** Key repeat on Enter, a double tap, or a click while a save is still running. Hold the API call open with `deferred()`, trigger twice, assert the API was called once and the second action did not hit the *next* item. (Fixed in `UnitView.advance` and `ReviewView.grade`.)
3. **Cleanup.** Anything added on `window`/`document` (`keydown`, `matchMedia`, `beforeinstallprompt`), timers (`setInterval`, `setTimeout`) and `document.body.style` locks must be undone on unmount. Test: unmount, then fire the event / advance fake timers, assert nothing happens.
4. **Async order.** Two requests that depend on each other (save the text, *then* ask Claude about it). Hold the first open and assert the second has not started.
5. **Every API call can fail.** Show the message, keep the user's input, let them continue or retry, and never leave a button disabled forever. Use `fakeApi.fail`.
6. **Boundaries.** Exactly the pass mark, zero answers (no division by zero), the last/first item, a saved position past the end, an empty list.
7. **Locked after checking.** Inputs and shortcuts must do nothing once an answer has been checked.
8. **Keyboard.** Enter/Escape/number keys, and *not* firing while typing in an input or textarea, or while a dialog is open.
9. **Resume.** Saved progress on entry (in progress vs. completed, clamped position).
10. **Dialogs.** Focus moves in, Escape closes, focus returns, background scroll lock is released.
11. **Content from data is text, not HTML.** Anything rendered with `v-html` must not run markup (`renderMd` has `html: false`; keep a test for each `v-html`).
12. **Secrets.** The API key never appears in the DOM after saving; only the masked value does.

## Gotchas (each cost time once)

- `beforeEach(() => someMock.mockClear())` **returns the mock, and Vitest treats a returned function as a cleanup hook** and calls it. Use braces: `beforeEach(() => { someMock.mockClear(); })`.
- Key events must reach `window`: mount attached to the document (`mountApp` does) and dispatch with `pressKey`. An event dispatched on a detached element goes nowhere and the test passes for the wrong reason.
- `setValue()` may already fire `change` as well as `input`. For a handler on `@change`, set `element.value` and call `trigger("change")` yourself; `setValue` followed by `trigger("change")` ran the handler twice.
- Fake timers: `vi.useFakeTimers({ now, toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date"] })` and `await vi.advanceTimersByTimeAsync(ms)`; don't fake the promise scheduler or `flushPromises` hangs.
- `fakeApi.on` is "newest wins": if a helper registers defaults, register your override *after* calling it.
- `<Teleport to="body">` content (e.g. `ReportIssue`) is in `document.body`, not in `wrapper`.
- jsdom has no `matchMedia`, `speechSynthesis` or real layout. Stub what you need; don't assert on sizes or visibility from CSS.
- Mock modules by their path as the component imports them: `../../../src/lib/progressFile`, `../../../src/lib/storage`.
- Random order (`shuffled`): find options by their text, never by position; mock `Math.random` only to test a rule about the shuffle itself.

## Coverage map

`tests/unit/component-coverage.test.ts` **fails when a `.vue` file is neither imported by a component test nor listed (with a reason) in `NOT_TESTED_DIRECTLY`.** When you add a component, add its test. Only add to that list for components with no logic, and write the reason.

| Area | Test file |
| --- | --- |
| Exercise types (mc, true/false, gap, conjugate, word order, match, form, reading) | `components/exercises.test.ts` |
| Exercise frame: check, save, explain, flag, retry | `components/ExerciseShell.test.ts` |
| Writing task + Claude feedback | `components/WritingExercise.test.ts` |
| Lesson player | `components/UnitView.test.ts` |
| Free practice and "meer oefenen met Claude" | `components/PracticeView.test.ts` |
| Word/verb review | `components/ReviewView.test.ts` |
| Mock exam player (timer, autosave, hand-in) | `components/ExamView.test.ts` |
| Exam result and writing feedback queue | `components/ExamResultView.test.ts` |
| App shell (menu, focus mode, theme) | `components/App.test.ts` |
| "Klaar voor vandaag" dialog | `components/FinishSessionDialog.test.ts` |
| Dashboard and module page | `components/Dashboard.test.ts` (where "Begin met leren" goes is decided in `shared/services/dashboard.ts`, tested in `services-progress.test.ts`) |
| Words and verbs lists | `components/WordLists.test.ts` |
| Settings, report a mistake, import | `components/SettingsAndReport.test.ts` |
| Lesson blocks, documents, exams list, writing history, welcome | `components/LessonContent.test.ts` |
| Install hint / storage protection | `components/InstallHint.test.ts` |
| Progress bar/ring, summary page | `components/Progress.test.ts` |

Known gaps (not component tests, but worth a look when you are nearby): `src/lib/*` (`storage.ts`, `progressFile.ts`) and `src/stores/*` have no direct tests (`backgrounds.ts` is covered by `tests/unit/backgrounds.test.ts`); the SpeakButton/voice choice is untested because jsdom has no speech synthesis.

## Checklist when you finish a change

1. `npm test` and `npx vue-tsc -b` are green.
2. Every behaviour you added or changed has a component test, and you saw it fail once (mutation check above).
3. A bug fix starts with a test that fails *before* the fix, in the same commit as the fix.
4. New `.vue` file → new test file or a reasoned entry in `NOT_TESTED_DIRECTLY`.
5. If you learned a new gotcha or a new class of bug, add it to this file.
