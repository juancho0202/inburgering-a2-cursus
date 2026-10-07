# Inburgering A2 trainer

A Vue 3 + Vite + Pinia app for practising the Dutch civic-integration exam (A2). No server: the "API" in `src/api/client.ts` runs in the browser on `shared/` services and IndexedDB. The UI text is Dutch; code, comments and docs are English. `SPEC.md` is the product spec, `README.md` (Dutch) has the user-facing overview.

## Commands

```bash
npm install
npm test            # Vitest: logic tests and component tests (jsdom)
npx vue-tsc -b      # type-check (also part of `npm run build`)
npm run build       # type-check + production build; fails if the course content is invalid
npm run validate    # check data/course
npm run e2e         # Playwright journeys (needs: npx playwright install chromium)
```

Run `npm install` first in a fresh checkout: `node_modules` is not committed, so the checks above cannot run without it.

## Testing rules (read `tests/README.md` before touching a component)

- **Every change to something a learner can see or do gets a component test** in `tests/unit/components/`, in the same commit. A bug fix starts with a test that fails before the fix.
- A test must be **meaningful**: it drives the screen like a person (click by visible text, type, press keys), asserts what is shown / saved (API call + body) / where the learner ends up, and would **fail if the code were broken**. No snapshots, no "renders without crashing", no restating static labels.
- **Prove it can fail**: break the code on purpose (invert a condition, remove a guard or cleanup, move a boundary) and see the test go red, then restore. Recipe in `tests/README.md`.
- For each screen ask the bug-hunting questions in `tests/README.md` (route param reuse, double trigger/key repeat, listener and timer cleanup, request order, failing API calls, boundaries, locked-after-check, keyboard, resume, dialogs/focus, `v-html`, secrets).
- Helpers: `tests/helpers/component.ts` (`fakeApi`, `mountApp`, `clickButton`, `pressKey`, `deferred`). Unregistered API calls reject, on purpose.
- `tests/unit/component-coverage.test.ts` fails when a new `.vue` file has no component test and no reasoned exception. Fix it by writing the tests.
- Logic in `shared/` is tested without a DOM in `tests/unit/*.test.ts`; a few whole journeys live in `tests/e2e/`. Use the cheapest layer that can fail for your reason.

## Conventions

- Match the surrounding code: comments explain *why*, short, English. UI strings are Dutch, simple (A2) language.
- Content ids are permanent: `npm run check-ids` fails when an id from an earlier version disappears.
- Keep changes minimal and in scope; open a PR only when asked.
