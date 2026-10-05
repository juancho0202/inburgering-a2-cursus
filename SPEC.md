# Inburgering A2 Trainer — Build Specification

> **For Claude Code.** This file is the complete specification for a local study app.
> Read the whole file before writing code. Build in the phases of §14, in order.
> After each phase: run the checks in that phase, show the user how to try it, and wait
> for the user's "ok" before starting the next phase. **Do not commit or push**: leave the
> changes in the working tree, because the user commits after reviewing them
> (initialise a git repository in Phase 1 if there is none).

---

## Table of contents

1. Goal and learner profile
2. The exams this app prepares for
3. Tech stack and hard constraints
4. Folder structure
5. Running the app
6. The file database
7. Content data model (JSON schemas)
8. Progress data model and spaced repetition
9. Exercise types
10. Claude API integration
11. Screens and UX
12. Content specification (what the course must contain)
13. Mock exams
14. Build phases with acceptance criteria
15. Testing and validation
16. Appendix A — the learner's samenvatting (seed content)
17. Appendix B — the learner's own difficult words
18. Appendix C — KNM fact sheet per theme
19. Appendix D — Schrijven templates and phrase bank

---

## 1. Goal and learner profile

Build a **local web app** that runs on the learner's own computer and teaches a complete,
simple **A2 Inburgering course** focused on three exams:

- **Lezen A2** (reading)
- **KNM — Kennis van de Nederlandse Maatschappij** (knowledge of Dutch society)
- **Schrijven A2** (writing)

Spreken (speaking) is **out of scope**; the learner will prepare it separately.
Luisteren (listening) is **already done**, but the vocabulary and grammar from it are reused.

**Learner profile**

- Adult, works with computers, has Claude Code and **Node 24** installed.
- Dutch level: solid A2 listening (scored 24/25 and 22/25 on official DUO Luisteren practice exams).
- Weak spots seen so far: directions (rechtsaf / rechtdoor), word order in subordinate clauses
  (wrote *"Denk ik dat we zullen een samenvatting doen"* instead of *"Ik denk dat we een samenvatting gaan maken"*),
  some work/government vocabulary (see Appendix B).
- **All UI and lesson text in simple Dutch (A2 level).** No English in the UI. The learner
  uses a browser translation extension to translate anything they don't understand, so:
  - Use real, selectable text everywhere (never put Dutch text inside images or canvas).
  - Keep sentences short (max ~15 words) and use common words in instructions.
- Wants to **stop and continue at any time**: every answer is saved immediately to disk.

---

## 2. The exams this app prepares for

Use these facts for exam simulation and strategy lessons. (Source: DUO, inburgeren.nl.)

| Exam | Format | Time | What it tests |
| --- | --- | --- | --- |
| Lezen A2 | Computer. Short everyday texts, multiple-choice questions. | 65 min | Finding information in letters, e-mails, ads, notices, schedules, forms, short articles. |
| KNM | Computer. Multiple-choice questions, often a short everyday situation ("Wat moet Fatima doen?"). | 45 min | 8 themes (below). The question does not say which theme it belongs to. |
| Schrijven A2 | **Pen and paper**. 4 writing tasks. | 40 min | Filling in a form, writing a short note/message, writing an (informal or formal) e-mail or letter. |

**KNM's 8 official themes**

1. Werk en inkomen
2. Omgangsvormen, waarden en normen
3. Wonen
4. Gezondheid en gezondheidszorg
5. Geschiedenis en geografie
6. Instanties
7. Staatsinrichting en rechtsstaat
8. Onderwijs en opvoeding

**Important:** never copy questions or texts from real DUO exams or DUO practice exams.
All content must be original. It may imitate the *style* and *difficulty* of the exams.

---

> **Direction change (2026-10-05): local-first.** Phases 1–7 built the app as a single-learner app with an
> Express server and JSON files. To share it with friends we are moving to a **static site (Netlify) with
> browser storage and "bring your own API key"**. The plan, decisions and work steps are in
> [`docs/production-readiness.md`](docs/production-readiness.md). **Where this SPEC and that document
> disagree, the document wins.** Sections below are marked *(as built)* where they describe the server
> version that is being replaced.

## 3. Tech stack and hard constraints

*Table: "now" = as built in phases 1–7; "target" = after the local-first work.*

| Concern | Choice |
| --- | --- |
| Runtime | Node 24 (use native `fetch`, `node:fs/promises`, ES modules everywhere; `"type": "module"`) |
| Language | TypeScript (strict) for both client and server |
| Frontend | Vue 3 (`<script setup>`, Composition API), Vite, Vue Router, Pinia |
| Styling | **Tailwind CSS v4** (`tailwindcss` + `@tailwindcss/vite`) with a custom theme defined in `src/styles/main.css` via `@theme` (colour tokens, fonts, radii, shadows). No component UI framework; build small reusable components in `src/components/ui/`. |
| Backend | Now: Express 5 JSON API run with `tsx`. **Target: none.** The old API paths are served by an in-browser router; the logic lives in `shared/services/` |
| Storage | Now: JSON files in `data/user/`. **Target: IndexedDB via `dexie`**, behind a `DataStore` interface. Facts are append-only events with unique ids; totals are derived (so progress files can be merged) |
| Validation | `zod` schemas shared across the app (`shared/` folder) |
| Claude | Official SDK `@anthropic-ai/sdk`. Now: server side only. **Target: called from the browser with the learner's own key** (`dangerouslyAllowBrowser: true`) behind the existing gateway interface |
| PWA | **Target:** `vite-plugin-pwa` (installable, offline, `navigator.storage.persist()`) |
| Hosting | **Target:** Netlify, static files only, strict CSP via `_headers` |
| Tests | Vitest (unit, services against an in-memory `DataStore`), Playwright (`@playwright/test`, smoke tests on a phone viewport, dev dependency) |
| Dev runner | Now: `concurrently` runs Vite + API. **Target:** Vite only |

**Hard constraints**

- **No database server, no backend of ours.** *(Target.)* Progress lives in the browser (IndexedDB). *(As built:
  JSON files in `data/`, see §6.)*
- **The API key belongs to the learner and goes only to Anthropic.** *(Target.)* Each learner pastes their own
  key; it is remembered on that device, **encrypted at rest** (non-extractable WebCrypto key), shown only
  masked (`sk-ant-…abcd`), and **never** included in progress files, exports, logs or URLs. The page's
  Content-Security-Policy allows network calls only to `self` and `https://api.anthropic.com`, and scripts
  only from `self`. *(As built: the key stayed on the server and never reached the browser.)*
- The app must work fully **without** an API key. Claude features show a friendly message
  ("Voeg een API-sleutel toe bij Instellingen") and fall back to self-check.
- No telemetry, no analytics, no third-party scripts. The only external call is to the Anthropic API.
- No login / accounts. Progress is moved between devices with a **progress file** ("Klaar voor vandaag" →
  save/share, "Ga verder met een bestand" → merge-import). Importing never deletes progress.
- Keep dependencies minimal. Ask the user before adding anything not listed here. *Approved for the
  local-first work:* `dexie`, `vite-plugin-pwa`, `@playwright/test` (dev).

---

## 4. Folder structure

> *(As built.)* `server/` and `data/user/` are removed in the local-first work; services move to `shared/services/`, Claude code to `shared/claude/`, scripts to `scripts/`. See `docs/production-readiness.md` §6 and §8.

```
inburgering-a2/
├─ SPEC.md                      ← this file
├─ README.md                    ← short Dutch+English start guide (write in Phase 1)
├─ package.json
├─ tsconfig.json  (+ tsconfig.node.json / tsconfig.server.json as needed)
├─ vite.config.ts               ← proxy /api → http://127.0.0.1:5174
├─ .gitignore                   ← node_modules, dist, data/user/
├─ shared/
│  ├─ schemas/                  ← zod schemas: content, exercises, progress, settings, claude I/O
│  └─ types.ts                  ← inferred TS types re-exported
├─ server/
│  ├─ index.ts                  ← Express app, mounts routers, 127.0.0.1:5174
│  ├─ db/
│  │  ├─ fileStore.ts           ← atomic JSON read/write, per-file write queue
│  │  ├─ contentRepo.ts         ← loads + validates course content, caches in memory
│  │  └─ progressRepo.ts        ← progress, SRS state, attempts, writing submissions
│  ├─ routes/
│  │  ├─ content.ts
│  │  ├─ progress.ts
│  │  ├─ settings.ts
│  │  └─ claude.ts
│  ├─ claude/
│  │  ├─ client.ts              ← builds Anthropic client from settings
│  │  ├─ prompts.ts             ← all system prompts (see §10)
│  │  └─ schemas.ts             ← JSON schemas for structured outputs
│  └─ scripts/
│     ├─ validate-content.ts    ← `npm run validate`
│     └─ content-stats.ts       ← `npm run stats` (counts per module/type)
├─ data/
│  ├─ course/                   ← CONTENT (committed, read-only for the app)
│  │  ├─ course.json            ← module list + order
│  │  ├─ basis/
│  │  │  ├─ module.json
│  │  │  ├─ vocab/*.json        ← one file per theme
│  │  │  ├─ verbs.json
│  │  │  └─ lessons/*.json      ← grammar lessons with exercises
│  │  ├─ lezen/
│  │  ├─ knm/
│  │  ├─ schrijven/
│  │  ├─ exams/                 ← mock exams
│  │  └─ generated/             ← exercises created by Claude (§10.4), still validated
│  └─ user/                     ← USER DATA (git-ignored)
│     ├─ progress.json
│     ├─ srs.json
│     ├─ attempts.jsonl         ← append-only log, one JSON object per line
│     ├─ writing.json           ← writing submissions + Claude feedback
│     └─ settings.json          ← API key, model, preferences
├─ src/
│  ├─ main.ts, App.vue, router.ts
│  ├─ api/                      ← typed fetch wrappers
│  ├─ stores/                   ← Pinia: content, progress, srs, settings
│  ├─ views/                    ← one per screen (§11)
│  ├─ components/
│  │  ├─ exercises/             ← one component per exercise type (§9)
│  │  └─ ui/                    ← buttons, cards, progress bars, timer
│  ├─ composables/              ← useSpeech, useTimer, useKeyboard, …
│  └─ styles/
└─ tests/
   ├─ unit/
   └─ e2e/
```

---

## 5. Running the app

> *(As built.)* After the local-first work `npm run dev` runs Vite only and `npm start` / the Express server no longer exist; the site is deployed to Netlify.

`package.json` scripts:

| Script | Does |
| --- | --- |
| `npm run dev` | Runs API (`tsx watch server/index.ts`) and Vite together via `concurrently`. Opens on http://localhost:5173 |
| `npm run build` | Type-check + Vite build into `dist/` |
| `npm start` | Server serves `dist/` + API on http://127.0.0.1:5174 (one process, for daily use) |
| `npm run validate` | Validates every content file against the zod schemas; exits non-zero on error |
| `npm run stats` | Prints counts per module and exercise type vs. the targets in §12 |
| `npm test` | Vitest |

On first start the server creates `data/user/` with empty default files if missing.

The `README.md` must explain, in short simple steps: install, `npm run dev`, where progress
is stored, how to back it up (copy `data/user/`), how to add the API key, and how to reset progress.

---

## 6. The file database

> *(As built, being replaced.)* Target storage is IndexedDB with merge rules; see `docs/production-readiness.md` §3.2. The content rules in §6.2 (unique, stable ids) still apply and become a CI check.

### 6.1 `fileStore.ts`

- `readJson<T>(path, schema, fallback)`: reads, parses, validates with zod. If the file is
  missing, returns `fallback` (and writes it). If it is corrupt, rename it to
  `<name>.corrupt-<timestamp>.json`, log a warning, and return `fallback`. Never crash.
- `writeJson(path, data)`: **atomic** — write to `<path>.tmp`, then `fs.rename` over the original.
- **Per-file write queue** (a promise chain per path) so two quick saves never interleave.
- `appendJsonl(path, obj)`: append one line to `attempts.jsonl`.
- Make a daily backup: on server start, if `data/user/backups/<YYYY-MM-DD>/` does not exist,
  copy all user files there. Keep the last 14 days.

### 6.2 Content loading

- `contentRepo` loads every file under `data/course/` at startup, validates it, builds
  in-memory indexes (by id, by module, by theme, by tag), and reports **all** validation errors
  with file path + JSON path. The server refuses to start in dev if content is invalid, and prints the errors.
- In dev, watch `data/course/` and reload on change (so new content shows up without restart).
- Every content item has a **globally unique, stable `id`** (kebab-case, prefixed by module:
  `basis-vocab-wonen-001`, `knm-wonen-q-014`, `lezen-tekst-07`). Progress refers to these ids,
  so ids must never change once created.

### 6.3 API endpoints

All JSON, all under `/api`.

| Method & path | Purpose |
| --- | --- |
| `GET /api/course` | Course tree: modules → units → items (ids, titles, types, counts) without heavy bodies |
| `GET /api/units/:unitId` | Full unit content |
| `GET /api/exams` / `GET /api/exams/:id` | Mock exam definitions |
| `GET /api/progress` | Whole progress summary for the dashboard |
| `POST /api/attempts` | Save one answer `{itemId, exerciseType, correct, answer, durationMs}`; updates progress + SRS |
| `POST /api/units/:unitId/complete` | Mark unit complete with score |
| `GET /api/srs/due?limit=30` | Vocabulary/verb cards due today |
| `POST /api/srs/review` | `{cardId, grade}` |
| `GET/POST /api/writing` | List / save writing submissions |
| `GET /api/settings` | Settings with **masked** key |
| `PUT /api/settings` | Update settings (key, model, daily goal, speech rate…) |
| `POST /api/settings/test-key` | Makes a tiny Claude call; returns ok / error message in Dutch |
| `POST /api/claude/feedback-writing` | §10.2 |
| `POST /api/claude/explain` | §10.3 |
| `POST /api/claude/generate` | §10.4 |
| `POST /api/progress/reset` | Reset (with a `{confirm: "RESET"}` body); makes a backup first |
| `GET /api/export` | Download a zip/JSON of `data/user/` |

Validate every request body with zod. Return errors as `{error: {code, message}}` where
`message` is simple Dutch suitable to show in the UI.

---

## 7. Content data model (JSON schemas)

Define these in `shared/schemas/content.ts` with zod. Below is the shape; implement exactly
this (add fields only if needed and document them here).

### 7.1 Course and modules

```jsonc
// data/course/course.json
{
  "id": "inburgering-a2",
  "title": "Inburgering A2",
  "modules": ["basis", "lezen", "knm", "schrijven", "exams"]
}

// data/course/knm/module.json
{
  "id": "knm",
  "title": "Kennis van de Nederlandse Maatschappij",
  "description": "Leer hoe Nederland werkt: werk, wonen, zorg, school en de overheid.",
  "icon": "landmark",
  "units": ["knm-werk", "knm-omgang", "knm-wonen", "knm-gezondheid",
            "knm-geschiedenis", "knm-instanties", "knm-staat", "knm-onderwijs"]
}
```

### 7.2 Unit

A unit = one sitting of 15–30 minutes. It has an ordered list of **steps**. A step is either
a lesson block (explanation) or an exercise.

```jsonc
{
  "id": "knm-wonen",
  "moduleId": "knm",
  "title": "Wonen",
  "goal": "Je weet hoe je een huis huurt, wat de huisbaas doet en wat jij moet doen.",
  "estimatedMinutes": 25,
  "tags": ["knm:wonen"],
  "vocabRefs": ["basis-vocab-wonen-001", "basis-vocab-wonen-002"], // words introduced
  "steps": [
    { "type": "lesson", "id": "knm-wonen-l-01", "title": "Een huis huren",
      "blocks": [ /* see 7.3 */ ] },
    { "type": "exercise", "exercise": { /* see §9 */ } }
  ],
  "passScore": 0.7
}
```

### 7.3 Lesson blocks

```jsonc
{ "kind": "text", "md": "In Nederland huren veel mensen een huis. ..." }        // small Markdown subset: **bold**, *italic*, lists, tables
{ "kind": "table", "headers": ["Je hoort", "Tijd"], "rows": [["half elf", "10.30"]] }
{ "kind": "tip", "md": "Let op: **half elf** is 10.30, niet 11.30." }
{ "kind": "example", "nl": "Morgen ga ik naar de dokter.", "note": "werkwoord op plek 2" }
{ "kind": "vocab", "ids": ["basis-vocab-wonen-001", "basis-vocab-wonen-004"] }  // renders word cards with 🔊
{ "kind": "dialogue", "lines": [{ "speaker": "Huisbaas", "nl": "..." }, { "speaker": "Ahmed", "nl": "..." }] }
{ "kind": "document", "docType": "brief|email|advertentie|formulier|bericht|rooster|folder",
  "title": "...", "body": "..." }                                               // realistic-looking text card (used in Lezen)
```

Render Markdown with a tiny safe renderer (e.g. `markdown-it` with `html: false`) — never `v-html` raw user/Claude text without sanitising.

### 7.4 Vocabulary entry

```jsonc
// data/course/basis/vocab/wonen.json
{
  "theme": "wonen",
  "title": "Wonen",
  "entries": [
    {
      "id": "basis-vocab-wonen-001",
      "nl": "de huur",
      "article": "de",          // "de" | "het" | null (for verbs/adjectives/phrases)
      "pos": "noun",            // noun | verb | adj | adv | phrase | prep | other
      "plural": null,           // e.g. "de huizen"
      "definitionNl": "Het geld dat je elke maand betaalt voor je huis.",
      "example": "De huur is 750 euro per maand.",
      "tags": ["knm:wonen", "lezen"],
      "level": "A2",            // A1 | A2
      "source": "samenvatting"  // samenvatting | learner-notes | course | generated
    }
  ]
}
```

**No English translations** in content (the learner uses a browser translator). Instead every
entry has a simple Dutch definition (`definitionNl`) and an example sentence.

### 7.5 Verb entry (`basis/verbs.json`)

```jsonc
{
  "id": "basis-verb-afspreken",
  "infinitive": "afspreken",
  "separable": true,
  "prefix": "af",
  "present": { "ik": "spreek af", "jij": "spreekt af", "hij": "spreekt af", "wij": "spreken af" },
  "past": { "sg": "sprak af", "pl": "spraken af" },
  "participle": "afgesproken",
  "auxiliary": "hebben",        // hebben | zijn | both
  "irregular": true,
  "definitionNl": "Samen een tijd en plek kiezen om elkaar te zien.",
  "example": "We spreken morgen om drie uur af bij het buurthuis."
}
```

---

## 8. Progress data model and spaced repetition

### 8.1 `data/user/progress.json`

```jsonc
{
  "version": 1,
  "startedAt": "2026-10-01T13:00:00Z",
  "lastActivityAt": "...",
  "lastLocation": { "unitId": "knm-wonen", "stepIndex": 4 },   // for "Verder waar ik was"
  "streak": { "current": 3, "best": 5, "lastDay": "2026-10-03" },
  "dailyGoalMinutes": 30,
  "minutesByDay": { "2026-10-01": 34 },
  "units": {
    "knm-wonen": { "status": "in_progress|completed", "bestScore": 0.85, "attempts": 2,
                   "stepIndex": 4, "completedAt": null }
  },
  "items": {
    "knm-wonen-q-014": { "seen": 3, "correct": 2, "lastCorrect": true, "lastSeenAt": "..." }
  },
  "exams": [
    { "examId": "exam-knm-1", "startedAt": "...", "finishedAt": "...", "score": 31, "max": 40,
      "answers": { "q1": "b" }, "byTheme": { "wonen": [4, 5] } }
  ]
}
```

### 8.2 Spaced repetition (`data/user/srs.json`)

Every vocab entry and verb becomes a **card**. Card types:

| Card type | Front | Back / input |
| --- | --- | --- |
| `meaning` | Dutch definition + example with gap | learner types / chooses the word |
| `recognise` | the Dutch word (🔊) | learner chooses the right definition (4 options) |
| `article` | noun without article | **de** or **het** (nouns only) |
| `verb-forms` | infinitive | type the participle + choose hebben/zijn (verbs only) |

Use a simple **Leitner** system (easy to reason about and test):

- Boxes 0–5, intervals in days: `[0, 1, 2, 4, 8, 16]`.
- Grade buttons: **Opnieuw** (wrong → box 0, due today, show again this session),
  **Moeilijk** (stay in box, due tomorrow), **Goed** (box +1), **Makkelijk** (box +2).
- A card is "geleerd" (learned) in box ≥ 4.
- New cards per day: setting, default 15. Reviews before new cards.
- Cards are introduced when the learner finishes the unit that references them (`vocabRefs`),
  plus a "Alle woorden van thema X leren" button on the vocab pages.
- State per card: `{ box, due, reps, lapses, lastReviewedAt }`.

Unit-test the scheduler (§15).

### 8.3 Weak spots

Compute on the dashboard:
- Items answered wrong ≥ 2 times and wrong last time → "Moeilijke vragen" practice session.
- Per tag accuracy (e.g. `knm:staat`, `grammar:bijzin`, `lezen:rooster`) → show the 3 weakest
  tags with a "Oefen dit" button that builds a mixed session from items with that tag.

---

## 9. Exercise types

All exercises share a base:

```jsonc
{
  "id": "knm-wonen-q-014",
  "type": "mc",                       // see table
  "tags": ["knm:wonen"],
  "prompt": "Wat moet Ahmed doen?",
  "context": "De verwarming in Ahmeds huurhuis is kapot.",   // optional situation
  "explanation": "De huisbaas moet grote reparaties betalen. Ahmed belt eerst de huisbaas.",
  "difficulty": 1                     // 1 easy – 3 hard
}
```

| `type` | Extra fields | Component behaviour |
| --- | --- | --- |
| `mc` | `options: string[]` (3 or 4), `answer: number` | Choose one. Shuffle options (store mapping). Show explanation after answering. |
| `mc-multi` | `options`, `answers: number[]` | Choose all correct. |
| `true-false` | `statement`, `answer: boolean` | "Klopt" / "Klopt niet". |
| `gap-fill` | `text` with `___` gaps, `answers: string[][]` (accepted variants per gap) | Type into gaps. Normalise: trim, collapse spaces, case-insensitive; accents optional but show the correct spelling. |
| `gap-choice` | `text` with gaps, `options: string[][]` per gap, `answers: number[]` | Dropdown per gap (good for de/het, niet/geen, omdat/want). |
| `word-order` | `tokens: string[]` (correct order), `alsoAccepted?: string[][]` | Shuffled tiles; tap to build the sentence; tap a placed tile to remove. Check. |
| `match` | `pairs: [left, right][]` | Match left to right (click-click, keyboard accessible). |
| `conjugate` | `verbId`, `person`, `tense` (`present`/`perfect`/`past`), `answers: string[]` | Type the form; for perfect also choose hebben/zijn. |
| `reading` | `document` (lesson block of kind `document`), `questions: mc[]` | Text on the left (top on mobile), questions on the right. Used in Lezen. |
| `form-fill` | `formTitle`, `fields: {label, kind, expected?, hint}[]`, `scenario` | Learner fills a realistic form from a scenario. Auto-check fields with `expected`; others self-check / Claude. |
| `writing` | `task` (see §12.4), `minWords`, `maxWords`, `requiredPoints: string[]`, `modelAnswer`, `checklist: string[]`, `register: "informal"\|"formal"` | Textarea with word counter. Submit → Claude feedback (§10.2) if key present, else self-check screen with model answer + checklist. |

**Shared exercise UX rules**

- Immediate feedback after "Controleer": green/red, the correct answer, the `explanation`.
- A **"Leg uit"** button on wrong answers → §10.3 (only shown if a key is configured).
- Keyboard: `1–4` choose option, `Enter` check/next, `Esc` back to unit overview.
- Every answer is POSTed to `/api/attempts` immediately (don't batch).
- 🔊 button on any Dutch sentence/word: Web Speech API, `lang="nl-NL"`, prefer a Dutch voice,
  rate setting (default 0.95). Hide 🔊 if no Dutch voice is available, with a one-time note.

---

## 10. Claude API integration

> *(As built.)* The prompts, schemas, validation and error messages below stay as they are. What changes: the calls are made from the browser with the learner's own key (see §3 and `docs/production-readiness.md` §5), and the "Keys" and "usage" parts live in browser storage instead of `settings.json`.

### 10.1 Setup

- Package: `@anthropic-ai/sdk`. Create the client in `server/claude/client.ts` from
  `data/user/settings.json` (`apiKey`, `model`). Also allow `ANTHROPIC_API_KEY` env var as a fallback.
- **Settings screen**: paste key → `PUT /api/settings` → `POST /api/settings/test-key`
  (a 1-sentence request with `max_tokens: 20`) → show "Sleutel werkt" or the error in Dutch.
- **Model choice** (dropdown in settings). Default **`claude-sonnet-5-5`** (good balance of
  quality and cost for writing feedback). Also offer `claude-haiku-4-5-20251001` (cheapest, fastest)
  and `claude-opus-5-5` (best quality). On opening settings, if a key is set, call the Models API
  (`client.models.list()`) to refresh the list; fall back to the three ids above if that fails.
  Verify current model ids at https://platform.claude.com/docs/en/models/overview before coding.
- Use **structured outputs** so responses are guaranteed JSON:
  ```ts
  const res = await client.messages.create({
    model,
    max_tokens: 2000,
    system: WRITING_FEEDBACK_SYSTEM,
    messages: [{ role: "user", content: userContent }],
    output_config: {
      format: { type: "json_schema", schema: writingFeedbackJsonSchema }
    }
  });
  const text = res.content.find(b => b.type === "text")?.text ?? "{}";
  const feedback = WritingFeedback.parse(JSON.parse(text)); // zod double-check
  ```
  Check https://platform.claude.com/docs/en/build-with-claude/structured-outputs for the current
  parameter shape and JSON-schema limitations (all objects need `additionalProperties: false`
  and every property listed in `required`). If the installed SDK version's types don't include
  `output_config`, upgrade the SDK rather than casting.
- **Errors**: map SDK errors to Dutch messages: 401 → "De API-sleutel klopt niet.",
  429 → "Te veel verzoeken. Probeer het over een minuut opnieuw.", 5xx/overloaded →
  "Claude is even niet bereikbaar. Je antwoord is wel opgeslagen.", network → "Geen internet."
  The learner's text is always saved **before** calling Claude, so nothing is lost.
- **Cost transparency**: store `usage.input_tokens` / `output_tokens` from each response in
  `writing.json` / a `usage` field in settings; show "Gebruik deze maand: ~X verzoeken" in settings.
  Do not hard-code prices.
- Timeout 60 s; one automatic retry on 529/overloaded with 2 s backoff (the SDK's built-in
  retries are fine — set `maxRetries: 2`).
- Show a loading state with a short Dutch message ("Claude leest je tekst…").

### 10.2 Writing feedback (`POST /api/claude/feedback-writing`)

Input: `{ exerciseId, text }` (server looks up the task, required points, register, model answer).

Output schema (`WritingFeedback`):

```jsonc
{
  "overall": "voldoende" | "bijna" | "onvoldoende",   // A2 exam-style verdict
  "score": 0-10,
  "criteria": [
    { "name": "Opdracht", "score": 0-3, "comment": "..." },       // all required points covered?
    { "name": "Begrijpelijk", "score": 0-3, "comment": "..." },   // can a Dutch reader understand it?
    { "name": "Grammatica", "score": 0-2, "comment": "..." },
    { "name": "Woorden en spelling", "score": 0-2, "comment": "..." }
  ],
  "missingPoints": ["..."],            // required points not covered
  "corrections": [
    { "original": "Denk ik dat we zullen een samenvatting doen",
      "corrected": "Ik denk dat we een samenvatting gaan maken",
      "type": "woordvolgorde" | "werkwoord" | "spelling" | "lidwoord" | "woordkeuze" | "hoofdletter/leesteken" | "anders",
      "explanation": "Na 'dat' staat het werkwoord aan het eind." }
  ],
  "correctedText": "...",              // the learner's text, minimally corrected (keep their ideas and level)
  "strongPoints": ["..."],
  "nextTip": "..."                     // one concrete thing to practise next
}
```

UI: show the verdict + score, criteria bars, the learner's text with corrections highlighted
(inline diff: strike-through original, green corrected), missing points, and the tip.
Add each correction `type` as a tag in progress (e.g. `writing:woordvolgorde`) so weak spots
include writing errors. Offer "Probeer opnieuw" (keeps old submission in history).

**System prompt** (`WRITING_FEEDBACK_SYSTEM` in `prompts.ts`):

```
Je bent een vriendelijke, eerlijke docent Nederlands als tweede taal. Je beoordeelt
schrijfopdrachten voor het inburgeringsexamen Schrijven op niveau A2.

Regels:
- Schrijf al je uitleg in eenvoudig Nederlands (niveau A2). Korte zinnen. Geen Engels.
- Beoordeel op A2-niveau, niet op B1 of hoger. Een tekst met kleine fouten kan voldoende zijn
  als de lezer hem begrijpt en alle punten van de opdracht erin staan.
- Het belangrijkste criterium is: staan alle gevraagde punten in de tekst?
- Verbeter alleen echte fouten. Herschrijf de tekst niet mooier dan nodig. Houd de ideeën
  en het niveau van de cursist.
- Geef maximaal 8 verbeteringen, de belangrijkste eerst.
- Let bij een formele brief/e-mail op: aanhef (Geachte …), afsluiting (Met vriendelijke groet),
  u in plaats van je. Bij een informeel bericht: Hoi/Beste, je/jij, Groetjes.
- Wees bemoedigend: noem ook wat goed is.
- Antwoord alleen met JSON volgens het schema.
```

User content template:

```
Opdracht:
{task.instructions}

Situatie:
{task.scenario}

Verplichte punten:
- {point 1}
- {point 2}

Register: {formal|informal}
Aantal woorden: minimaal {minWords}, maximaal {maxWords}. De cursist schreef {wordCount} woorden.

Tekst van de cursist:
"""
{text}
"""
```

(Do **not** send the model answer to Claude for grading — it biases toward one solution.)

### 10.3 Explain a mistake (`POST /api/claude/explain`)

Input: `{ itemId, learnerAnswer }`. Server sends the exercise (prompt, options, correct answer,
existing explanation) and the learner's answer.
Output schema: `{ "explanation": string, "rule": string | null, "extraExamples": string[] (max 3) }`.
System prompt: explain in simple Dutch (A2), max 80 words, why the learner's answer is wrong
and why the right answer is right; give a short rule if there is one; 2–3 new example sentences.
Cache the result per `(itemId, learnerAnswer)` in `data/user/explanations.json` to avoid repeat calls.

### 10.4 Generate extra practice (`POST /api/claude/generate`)

Button "Meer oefenen met Claude" at the end of a unit or on a weak tag.
Input: `{ unitId | tag, type: "mc" | "gap-fill" | "word-order" | "reading", count: 5–10 }`.
The server sends the unit goal, vocab list and 3 existing exercises as style examples, and asks
for new exercises **in the exact JSON format of §9** (use structured outputs with the exercise
schema as a JSON schema; for `mc` include `options`, `answer`, `explanation`).
Validate with zod, give them ids `gen-<unitId>-<timestamp>-<n>`, save to
`data/course/generated/<unitId>.json` with `"source": "generated"`, and show them in a
practice session. Mark generated items with a small "Claude" badge. Allow the learner to
flag a bad item ("Klopt niet") which hides it.

For KNM generation, include the relevant section of Appendix C in the prompt and instruct:
"Gebruik alleen feiten uit de gegeven tekst. Verzin geen feiten, bedragen of datums."

### 10.5 Optional: free chat tutor (Phase 7, only if time permits)

A side panel "Vraag het Claude" where the learner can ask a question about the current lesson.
System prompt: A2 Dutch tutor, answers in simple Dutch, max ~120 words, uses the current unit
as context. Stream the answer (SDK `messages.stream`). Keep the last 10 messages per unit in memory only.

---

## 11. Screens and UX

### 11.1 Screens (routes)

| Route | Screen |
| --- | --- |
| `/` | **Dashboard**: "Verder waar ik was" (big button), today's goal ring (minutes), streak, "Woorden herhalen (N)" button, progress bar per module, 3 weakest tags with "Oefen dit", next mock exam suggestion. |
| `/module/:id` | Module overview: units as a vertical path, status (not started / in progress / done + best score), estimated minutes. Units are all unlocked (the learner chooses), but show a recommended order. |
| `/unit/:id` | Unit player: progress bar of steps, one step at a time, "Vorige"/"Volgende". Resume at `stepIndex`. End screen: score, words learned, buttons "Opnieuw", "Moeilijke vragen", "Meer oefenen met Claude", "Volgende les". |
| `/woorden` | Vocabulary browser: by theme, search, filter (de/het, learned/not), 🔊, "Leer dit thema". |
| `/woorden/herhalen` | SRS review session. |
| `/werkwoorden` | Verb table (search, filter separable/irregular) + "Oefen werkwoorden" session. |
| `/schrijven/geschiedenis` | All writing submissions with feedback, filter by task type. |
| `/examens` | Mock exam list with past scores. |
| `/examen/:id` | Exam mode (§13). |
| `/samenvatting` | The learner's samenvatting (Appendix A) rendered as a reference page with anchor links. |
| `/instellingen` | API key, model, daily goal, new cards/day, speech rate, export/backup, reset. |

### 11.2 Visual design

- **The course must look modern, friendly and polished** — like a good language-learning app,
  not a bare prototype. Built with Tailwind CSS (§3). Concretely:
  - A consistent design system: one `@theme` block with semantic tokens (`brand`, `surface`,
    `ink`, `muted`, `good`, `bad`), a rounded-2xl card style, soft shadows, generous spacing,
    a clean sans-serif font stack (system fonts; no external font calls, see §3).
  - App shell: top navigation (logo, Leren, Woorden, Examens, Instellingen), content centred
    in a max-width container, subtle page background distinct from white cards.
  - Friendly touches: module icons and colour per module (basis, lezen, knm, schrijven, exams),
    progress rings and bars, a vertical "path" of units, large tappable answer buttons,
    smooth but short transitions (respect `prefers-reduced-motion`), clear hover/focus/active states.
  - Exercise screens are uncluttered: one question per screen, big type, a sticky bottom bar
    with "Controleer" / "Volgende", and a coloured feedback panel (green/red) that slides up.
- Calm, focused, readable. Large body text (18px), line-height 1.6, max text width ~70ch.
- Light and dark mode (follow `prefers-color-scheme`, with a toggle in settings; Tailwind `dark:` variant driven by a `dark` class on `<html>`).
- Colour tokens defined once in `@theme`. One accent colour (suggest Dutch orange `#E8710A` used sparingly)
  plus green for correct, red for wrong — never colour alone: also an icon (✓ / ✗) and text.
- Mobile-friendly layout (the learner may open it on a phone on the same machine).
- Reading exercises: document cards look like the real thing (a letter with sender/date,
  an advertisement box, a timetable table) — use CSS, not images.
- Accessibility: all buttons are real `<button>`s, visible focus ring, labels on inputs,
  `lang="nl"` on `<html>`, ARIA live region for feedback messages.
- Writing textarea: `spellcheck="false"` by default (the real exam is pen and paper, no spell check),
  with a settings toggle.

### 11.3 Microcopy (examples, simple Dutch)

- Correct: "Goed zo!", "Helemaal goed.", "Prima!"
- Wrong: "Bijna. Het goede antwoord is: …", "Niet goed. Kijk naar de uitleg."
- Empty state: "Je hebt vandaag alle woorden herhaald. Goed bezig!"
- Unit done: "Les klaar! Je score: 8 van 10."

---

## 12. Content specification

Content is the heart of this app. Write it as JSON in `data/course/`. Quality rules:

- **Original**, realistic, everyday Netherlands. Names from diverse backgrounds
  (Ahmed, Fatima, Juan, Olga, Mehmet, Priya, Sanne, Pieter, Wei, Amira…).
- **A2 level**: common words, short sentences, present tense and perfectum mostly.
- Every exercise has an `explanation` in simple Dutch.
- Distractors in MC must be plausible (same category, ideally something mentioned in the text).
- No facts that change yearly as hard numbers (minimum wage, eigen risico amount, toeslag amounts).
  Describe the rule, not the amount. If an amount is unavoidable, don't make it the answer to a question.
- Run `npm run validate` and `npm run stats` after each content batch.

### 12.1 Module **basis** (foundation; built from Appendix A)

Units (recommended order):

| Unit id | Title | Content | Exercises (min.) |
| --- | --- | --- | --- |
| `basis-tijd` | Tijd, getallen en datums | Klok (half, kwart over/voor, tien voor half), dagdelen, dagen, maanden, getallen (13/30, 14/40), datums, geld | 25 (mc, gap-fill, match) |
| `basis-werkwoorden-nu` | Werkwoorden: nu | Stam + t, zijn/hebben, inversie zonder -t na jij | 20 (conjugate, gap-choice) |
| `basis-modaal` | Moeten, kunnen, willen, mogen, hoeven | Modal + infinitief aan het eind; hoeven + niet/geen | 15 |
| `basis-toekomst` | De toekomst | gaan + infinitief, zullen | 10 |
| `basis-perfectum` | Het perfectum | ge-stam-t/d, 't kofschip, onregelmatige deelwoorden, hebben vs zijn | 25 |
| `basis-imperfectum` | Was, had, ging | Herkennen van imperfectum (Lezen!) | 12 |
| `basis-scheidbaar` | Scheidbare werkwoorden | afspreken, inleveren, overstappen, meenemen, opbellen, invullen, opzeggen, aanvragen | 15 |
| `basis-zinsbouw` | Werkwoord op plek 2 | Hoofdzin, inversie, vragen | 20 (word-order) |
| `basis-bijzin` | Bijzinnen | dat, omdat, als, wanneer, of, terwijl, voordat, nadat vs want/maar/en/dus | 20 (word-order, gap-choice) |
| `basis-niet-geen` | Niet of geen | Regels + plek van niet | 15 |
| `basis-de-het` | De of het | Regels, meervoud, verkleinwoord | 20 |
| `basis-bijvoeglijk` | Bijvoeglijk naamwoord en vergelijken | -e regel, groter/grootst, onregelmatig | 15 |
| `basis-voornaamwoorden` | Ik, mij, mijn | Persoonlijk + bezittelijk | 12 |
| `basis-voorzetsels` | Voorzetsels en richting | in/op/bij/naast/tegenover…; rechtsaf/linksaf/rechtdoor | 15 |
| `basis-signaalwoorden` | Signaalwoorden | maar, toch, want, omdat, dus, eerst/daarna, als | 15 |
| `basis-mijn-woorden` | Mijn woorden | Appendix B words | 15 |

**Vocabulary:** at least **500 entries** across these theme files:
`persoon` (jezelf voorstellen, familie), `wonen`, `werk`, `gezondheid`, `winkelen-geld`,
`vervoer-richting`, `school-kinderen`, `gemeente-instanties`, `cursus-opleiding`,
`vrije-tijd-weer`, `tijd`, `eten-drinken`, `lichaam`, `kleding`, `post-internet-telefoon`,
`overheid-politiek` (for KNM), `feesten-tradities` (for KNM).
Include all words from Appendix A's theme table and all of Appendix B (`source: "learner-notes"`).

**Verbs:** at least **80** verbs in `verbs.json`, including all from Appendix A plus the most
common A2 verbs (zijn, hebben, gaan, komen, doen, maken, zien, kijken, lezen, schrijven,
werken, wonen, betalen, bellen, vragen, zeggen, geven, krijgen, nemen, brengen, kopen, verkopen,
eten, drinken, slapen, beginnen, stoppen, wachten, helpen, zoeken, vinden, sturen, invullen,
aanvragen, opzeggen, ophalen, terugbellen, verhuizen, solliciteren, trouwen, inleveren, …).

### 12.2 Module **lezen**

Units:

| Unit id | Title | Content |
| --- | --- | --- |
| `lezen-strategie` | Zo lees je slim | Lees eerst de vraag; zoek kernwoorden; scan voor getallen/tijden/namen; let op signaalwoorden (maar, niet, geen, alleen, behalve, uiterlijk, vóór); antwoord staat vaak in andere woorden (synoniemen). Short drills. |
| `lezen-brieven` | Brieven van instanties | Letters from gemeente, huisbaas, school, zorgverzekeraar, Belastingdienst (simplified) |
| `lezen-emails` | E-mails en berichten | From colleague, teacher, neighbour, company |
| `lezen-advertenties` | Advertenties | Job ads, house ads, things for sale, courses |
| `lezen-mededelingen` | Mededelingen en borden | Notices in buildings, shops, station, rules, opening hours |
| `lezen-roosters` | Roosters en tabellen | Timetables, opening hours tables, price lists, work schedules |
| `lezen-formulieren` | Formulieren en folders | Understanding forms and info leaflets (what must you bring, before which date) |
| `lezen-artikelen` | Korte artikelen | Short local news / magazine items |

Targets: **≥ 30 reading texts** (`reading` exercises), each 60–250 words, each with **3–5 questions**
(≥ 120 questions total). Question types to mix: *Wat is het doel van de tekst?*, specific detail
(time, date, place, price, person), *Wat moet je doen?*, *Wat is waar?*, *Voor wie is deze tekst?*,
vocabulary in context. Include texts with traps: changed dates, "behalve", "alleen op …",
"uiterlijk 1 maart", conditions ("Als u … dan …").
Also a **synonyms** drill unit content (e.g. *aanvragen = vragen om*, *uiterlijk = op zijn laatst*,
*kosteloos = gratis*, *legitimatiebewijs = paspoort of ID-kaart*) — ≥ 40 pairs as `match` exercises,
placed in `lezen-strategie`.

### 12.3 Module **knm**

One unit per theme (8 units). Each unit:
- 4–6 short lesson blocks in simple Dutch, built **only on the facts in Appendix C** (extend
  carefully with well-established facts; never invent).
- 15–25 key vocab entries (also added to vocab theme files with tag `knm:<theme>`).
- **≥ 25 questions** per theme (≥ 200 total), mostly situation-based MC:
  *"Olga heeft hoge koorts in het weekend. De huisarts is gesloten. Wat moet ze doen?"*
  plus some fact questions (*"Hoeveel provincies heeft Nederland?"*).
- A final "Gemengd" unit `knm-gemengd` that draws randomly from all themes without saying
  the theme (like the real exam).

### 12.4 Module **schrijven**

Units:

| Unit id | Title | Content |
| --- | --- | --- |
| `schrijven-basis` | Goede zinnen schrijven | Hoofdletters en punten, werkwoord op plek 2, bijzinnen, linking words (en, maar, want, omdat, dus, ook), word-order drills built from typical writing sentences |
| `schrijven-formulier` | Een formulier invullen | Personal data vocabulary (voornaam, achternaam, geboortedatum, adres, postcode, woonplaats, telefoonnummer, handtekening, nationaliteit, burgerlijke staat), date format (dd-mm-jjjj), short answers on forms. `form-fill` exercises: library card, sports club, doctor registration, course sign-up, change of address |
| `schrijven-kort-bericht` | Een kort bericht | Notes to neighbour/colleague/teacher (absence, request, apology, invitation), 25–50 words |
| `schrijven-informele-mail` | Een informele e-mail | To friend/colleague/neighbour: invite, thank, ask, cancel, tell news. 40–80 words |
| `schrijven-formele-mail` | Een formele e-mail of brief | To gemeente, huisbaas, school, company, doctor: complaint, request info, make/cancel appointment, report a problem. 50–100 words |
| `schrijven-examen-tips` | Tips voor het examen | Read task twice, tick off every point, plan 10 min per task, check verbs + capitals, write clearly (pen and paper) |

Each type unit: lesson (structure + template from Appendix D + phrase bank), 1 annotated model
answer, gap-fill and word-order exercises using the phrases, then **≥ 4 `writing` tasks**
(≥ 16 total). Every writing task has: `instructions`, `scenario`, `requiredPoints` (2–4 bullet
points, like the exam), `minWords`, `maxWords`, `register`, `modelAnswer`, `checklist`.

Example writing task:

```jsonc
{
  "id": "schrijven-formeel-03",
  "type": "writing",
  "tags": ["schrijven:formeel", "wonen"],
  "prompt": "Schrijf een e-mail aan uw huisbaas.",
  "task": {
    "instructions": "Schrijf een e-mail aan uw huisbaas, meneer De Groot.",
    "scenario": "De verwarming in uw huis doet het al drie dagen niet. Het is koud.",
    "requiredPoints": [
      "Vertel wat het probleem is.",
      "Vertel sinds wanneer het probleem er is.",
      "Vraag wanneer iemand het kan repareren."
    ]
  },
  "register": "formal",
  "minWords": 40, "maxWords": 100,
  "modelAnswer": "Geachte heer De Groot,\n\nDe verwarming in mijn huis doet het niet. Het probleem is er al sinds maandag, dus drie dagen. Het is erg koud in huis, ook voor mijn kinderen.\n\nWanneer kan iemand de verwarming komen repareren? Ik ben elke dag na 15.00 uur thuis.\n\nMet vriendelijke groet,\n\nJuan García\nKerkstraat 12, Utrecht",
  "checklist": [
    "Aanhef: Geachte heer De Groot,",
    "Probleem genoemd",
    "Sinds wanneer genoemd",
    "Vraag over reparatie gesteld",
    "u (niet je)",
    "Afsluiting: Met vriendelijke groet, + naam"
  ],
  "explanation": "In een formele e-mail gebruik je 'Geachte' en 'Met vriendelijke groet'."
}
```

### 12.5 Content targets summary (`npm run stats` must report these)

| Metric | Target |
| --- | --- |
| Vocab entries | ≥ 500 |
| Verbs | ≥ 80 |
| Basis exercises | ≥ 250 |
| Lezen texts / questions | ≥ 30 / ≥ 120 |
| KNM questions | ≥ 200 (≥ 25 per theme) |
| Schrijven writing tasks | ≥ 16 (≥ 4 per type) + ≥ 5 form-fill |
| Mock exams | 2 Lezen, 2 KNM, 2 Schrijven |

---

## 13. Mock exams

`data/course/exams/*.json`:

```jsonc
{
  "id": "exam-knm-1",
  "skill": "knm",                    // lezen | knm | schrijven
  "title": "Proefexamen KNM 1",
  "durationMinutes": 45,
  "items": [ /* exercise objects or { "ref": "<existing item id>" } */ ],
  "passScore": 0.7                   // our own practice threshold; DUO does not publish one — say so in the UI
}
```

- **Lezen**: 65 min, ~8–10 texts, ~25 questions, texts NOT reused from the units.
- **KNM**: 45 min, 40 questions, mixed themes, no theme labels, NOT reused from units.
- **Schrijven**: 40 min, 4 tasks: 1 form-fill, 1 short message, 1 informal e-mail, 1 formal e-mail/letter.

Exam mode rules:
- Full-screen focused view, countdown timer (warn at 10 and 5 minutes), question navigator
  (answered / flagged / open), "Markeer" flag button.
- No explanations or feedback until the learner clicks "Inleveren" or time runs out.
- Results: score, per-theme/tag breakdown, list of wrong answers with explanations,
  "Oefen je fouten" button. For Schrijven: each task sent to Claude feedback (sequentially, with
  progress) if a key is set; otherwise self-check.
- State saved continuously, so a browser refresh resumes the exam with the remaining time.
- Shown text: "Dit is een oefenexamen. De echte score van DUO kan anders zijn."

---

## 14. Build phases with acceptance criteria

Work through these phases in order. At the end of each, run `npm run validate`, `npm test`,
`npm run build`, then tell the user what to try.

### Phase 1 — Skeleton, file database, settings
- Project scaffold (§3, §4), scripts (§5), README.
- `fileStore` (atomic writes, queue, corrupt-file handling, daily backups) + unit tests.
- Zod schemas for all content types (§7, §9) and progress (§8).
- `contentRepo` with validation errors listed per file; `validate` and `stats` scripts.
- Settings screen + `/api/settings` + test-key endpoint (key masked).
- Minimal content: `course.json`, 5 `module.json` files, one tiny unit per module so screens can render.
- **Accept when:** `npm run dev` opens the dashboard; a saved setting survives a server restart;
  corrupting `progress.json` by hand doesn't crash the server; `npm run validate` catches a
  deliberately broken content file.

### Phase 2 — Theme, unit player, all exercise components, progress, SRS
- **Install Tailwind v4 and apply the theme (§3, §11.2)** to the existing shell, dashboard,
  module, unit and settings screens before building new screens. Shared UI components in `src/components/ui/`.
- All exercise components of §9 (with keyboard support) and the lesson block renderer.
- Unit player with resume, end screen; attempts saved; dashboard with real progress.
- Leitner SRS (§8.2) + review screen + vocab browser + verb table; Web Speech 🔊.
- Weak-spot computation (§8.3).
- **Accept when:** the learner can complete a unit, close the browser, reopen, and continue at the
  same step; SRS scheduler unit tests pass; each exercise type has a demo item that works.

### Phase 3 — Basis content
- Convert Appendix A + B into units, vocab and verbs; then extend to the targets in §12.1.
- `/samenvatting` reference page.
- **Accept when:** `npm run stats` meets the basis/vocab/verb targets; content validates.

### Phase 4 — KNM content
- 8 theme units + `knm-gemengd` from Appendix C (§12.3).
- **Accept when:** ≥ 200 questions, ≥ 25 per theme; spot-check 10 random questions with the
  user for correctness.

### Phase 5 — Lezen content
- 8 units, ≥ 30 texts, synonyms drill (§12.2); realistic document styling.
- **Accept when:** targets met; documents render well on desktop and phone widths.

### Phase 6 — Schrijven + Claude
- Schrijven units (§12.4) with `form-fill` and `writing` exercises.
- Claude writing feedback (§10.2) with correction highlighting; self-check fallback.
- "Leg uit" (§10.3) with caching; "Meer oefenen met Claude" (§10.4).
- Writing history screen.
- **Accept when:** with a valid key, a submitted e-mail returns structured feedback shown with
  highlighted corrections; with no key or a wrong key, the learner sees the Dutch error and the
  self-check screen, and the text is saved either way.

### Phase 7 — Mock exams and polish
- 6 mock exams (§13), exam mode, results.
- Export/backup/reset in settings; dark mode toggle; empty states; final accessibility pass.
- Optional: chat tutor (§10.5).
- **Accept when:** a full KNM mock exam can be taken with timer, refreshed mid-way and resumed,
  and results show per-theme scores.

---

## 15. Testing and validation

- **Unit tests (Vitest)**: fileStore (atomic write, queue, corrupt file), Leitner scheduler
  (each grade, due dates, new-card limit), answer normalisation for gap-fill, word-order checking
  (including `alsoAccepted`), weak-spot computation, writing word counter, zod schemas for
  Claude output (parse a sample feedback JSON).
- **Claude calls**: wrap the SDK behind an interface so tests use a fake. No real API calls in tests.
- **Content validation** (`npm run validate`): zod schemas + extra checks — unique ids across all
  files; `answer` index within `options`; every `vocabRefs`/`ref` id exists; no empty explanations;
  word-order tokens non-empty; writing tasks have 2–4 required points; no English words in
  `explanation`/lesson text (warn using a small stoplist: "the", "and", "is not", "because", "you").
- **Smoke test (Playwright, optional)**: open dashboard → start a unit → answer one MC → reload → step resumed.
- Before finishing each phase: `npm run build` with zero TypeScript errors.

---

## 16. Appendix A — The learner's samenvatting (seed content)

This is the learner's own A2 summary. Use it as the backbone of the Basis module and render it
on `/samenvatting`. Keep its wording where possible.

### A.1 Thema's en woordenschat

A2 gaat over het dagelijks leven. Het examen gebruikt steeds dezelfde situaties.

| Thema | Situatie | Belangrijke woorden |
| --- | --- | --- |
| Jezelf voorstellen | kennismaken, buren | heten, wonen, getrouwd, kinderen, afkomstig uit, de buren |
| Wonen | huur, reparatie, verhuizen | de huur, de huisbaas, kapot, repareren, verhuizen, het buurthuis |
| Werk | nieuwe baan, rooster, collega | de baan, de baas, de leidinggevende, de dienst, het rooster, solliciteren, het gesprek |
| Gezondheid | huisarts, apotheek, ziekenhuis | de afspraak, de huisarts, de assistente, ziek, pijn, de pillen, de afdeling |
| Winkelen en geld | kopen, ruilen, korting | kosten, de korting, de bon, ruilen, geld terug, de bestelling, betalen |
| Vervoer | trein, bus, route | de vertraging, het spoor, overstappen, vertrekken, aankomen, de halte |
| School en kinderen | ouderavond, uitje | de juf, de meester, de klas, meenemen, het schoolreisje |
| Gemeente en instanties | paspoort, trouwen, formulier | het loket, de balie, het legitimatiebewijs, het formulier, invullen, inleveren |
| Cursus en opleiding | les, cursist, examen | de cursist, de docent, de opleiding, de les, afspreken |
| Vrije tijd en weer | weekend, sport, uitje | de regen, de zon, koud, lekker weer, sporten, het feest |

### A.2 Tijd, getallen en datums

Bij **half** denk je aan het volgende uur: half elf = 10.30.

| Je hoort | Tijd |
| --- | --- |
| tien uur | 10.00 |
| vijf over tien | 10.05 |
| kwart over tien | 10.15 |
| tien voor half elf | 10.20 |
| half elf | 10.30 |
| vijf over half elf | 10.35 |
| kwart voor elf | 10.45 |
| tien voor elf | 10.50 |

- Dagdelen: 's ochtends (6–12), 's middags (12–18), 's avonds (18–24), 's nachts (0–6).
- Dagen: maandag … zondag. Let op: dinsdag en donderdag lijken op elkaar.
- Getallen: het kleine getal eerst. 21 = eenentwintig, 48 = achtenveertig.
  Verwar niet: dertien/dertig, veertien/veertig, zeventien/zeventig.
- Geld: € 12,50 = twaalf euro vijftig.
- Datums: de eerste, de tweede, de derde, de achtste, de twintigste. Op 3 mei = op drie mei.
- Tijdwoorden: gisteren, vandaag, morgen, overmorgen, volgende week, vorige week, binnenkort,
  tot einde volgende maand.

### A.3 Werkwoorden

Tegenwoordige tijd: stam = infinitief min -en (werken → werk).

| | werken | zijn | hebben |
| --- | --- | --- | --- |
| ik | werk | ben | heb |
| jij / u | werkt | bent | hebt / heeft |
| hij / zij | werkt | is | heeft |
| wij / jullie / zij | werken | zijn | hebben |

- Inversie: de -t valt weg na jij: *Werk jij morgen?*
- Modale werkwoorden + infinitief aan het eind: kunnen, moeten, willen, mogen, hoeven.
  *Ik moet morgen werken. Kunt u woensdag komen?*
- hoeven + niet/geen = niet nodig: *Je hoeft niets te doen. Eten hoeft niet.*
- Toekomst: gaan + infinitief: *Hij gaat binnenkort trouwen.* Formeler: *Ik zal het doen.*
- Perfectum: hebben/zijn + voltooid deelwoord.
  - Regelmatig: ge + stam + t/d. t als de stam eindigt op een letter uit **'t kofschip**
    (t, k, f, s, ch, p): gewerkt, gekookt. Anders d: gewoond, gebeld.
  - Onregelmatig: gegaan, gekomen, gedaan, gezien, gegeten, gedronken, gekregen, gebracht,
    gekocht, gegeven, geweest, gehad.
  - zijn bij beweging naar een plek of verandering (*Ik ben naar huis gegaan. Hij is ziek geworden.*),
    anders hebben (*Ik heb brood gekocht.*).
- Imperfectum (herkennen): was/waren, had/hadden, ging, kwam, zei, kon, moest, wilde.
- Scheidbare werkwoorden: het eerste deel gaat naar het eind.

| Infinitief | In een zin | Perfectum |
| --- | --- | --- |
| afspreken | We spreken morgen af. | We hebben afgesproken. |
| inleveren | Ik lever het formulier in. | Ik heb het ingeleverd. |
| overstappen | U stapt in Utrecht over. | Ik ben overgestapt. |
| meenemen | Neem een jas mee. | Ik heb een jas meegenomen. |
| opbellen | Ik bel je morgen op. | Ik heb je opgebeld. |

Tip: wacht op het laatste woordje. *Ik bel* ≠ *ik bel af* (afzeggen).

### A.4 Zinsbouw

In een gewone zin staat het werkwoord op plek 2. In een bijzin staan de werkwoorden aan het eind.

| Plek 1 | Plek 2 (werkwoord) | Rest | Eind |
| --- | --- | --- | --- |
| Ik | ga | morgen naar de dokter. | |
| Morgen | ga | ik naar de dokter. | |
| Ik | moet | morgen | werken. |
| Gisteren | heb | ik brood | gekocht. |

- Begint de zin met tijd of plaats? Dan komt het onderwerp na het werkwoord (inversie).
- Ja/nee-vraag: werkwoord eerst (*Komt u woensdag?*). Vraagwoord eerst: wie, wat, waar,
  wanneer, hoe laat, hoeveel, hoelang, waarom, welke.
- Bijzin (dat, omdat, als, wanneer, of, terwijl, voordat, nadat): werkwoorden naar het eind.
  *Ik denk dat we een samenvatting gaan maken. Ik kan niet komen, omdat mijn zoon ziek is.*
- Na want, maar, en, dus: gewone volgorde. *Ik kan niet komen, want mijn zoon is ziek.*
- Voorbeeld van de cursist: ~~Denk ik dat we zullen een samenvatting doen.~~ →
  **Ik denk dat we een samenvatting gaan maken.** (zin begint met onderwerp; na *dat* werkwoorden
  aan het eind; je *maakt* een samenvatting.)
- Niet of geen: **geen** = niet + een, of een zelfstandig naamwoord zonder lidwoord
  (*Ik heb geen auto / geen tijd*). **niet** voor de rest. Plek van niet: aan het eind, maar vóór
  een voorzetsel, bijvoeglijk naamwoord of het laatste werkwoord.

### A.5 Woorden

- Altijd **het**: verkleinwoorden, infinitieven als woord (het eten), -ment, -isme.
- Altijd **de**: meervouden, personen, -ing, -heid, -tie.
- Vaak **het**: ge-, be-, ver- (het gesprek, het bericht, het verhaal).
- Meervoud: meestal -en (dozen, boeken); -s na -el, -er, -en, -je en leenwoorden (tafels, blikjes, auto's).
- Verkleinwoord: -je, -tje, -pje, -etje (blikje, boompje, balletje).
- Bijvoeglijk naamwoord + e, behalve bij *een* + het-woord: de grote jas, een grote jas,
  het grote huis, **een groot huis**, grote huizen.
- Vergelijken: groot → groter → grootst; goed → beter → best; veel → meer → meest;
  vaak → vaker → vaakst; graag → liever → liefst.

| Onderwerp | Na werkwoord/voorzetsel | Van wie |
| --- | --- | --- |
| ik | mij / me | mijn |
| jij / je | jou / je | jouw / je |
| u | u | uw |
| hij | hem | zijn |
| zij / ze | haar | haar |
| wij / we | ons | ons / onze |
| jullie | jullie | jullie |
| zij / ze | hen / hun / ze | hun |

- Voorzetsels van plaats: in, op, bij, naast, tegenover, achter, voor, onder, boven, tussen.
  Richting: naar, van, door, langs.

### A.6 Signaalwoorden (useful for Lezen too)

| Signaalwoord | Betekenis |
| --- | --- |
| maar, toch, helaas, eigenlijk | het plan verandert → het goede antwoord komt na het signaalwoord |
| niet … maar … | correctie |
| want, omdat | reden |
| dus | gevolg |
| als, wanneer | voorwaarde |
| hoeft niet, geen, niet | ontkenning |
| eerst, dan, daarna, tot slot | volgorde |
| vaker, meestal, altijd, nooit | hoe vaak |

Richting: **-af** = afslaan (rechtsaf, linksaf); **-door** = doorlopen (rechtdoor);
tegenover, naast, op de hoek, aan uw rechterhand, de tweede straat links.

---

## 17. Appendix B — The learner's own difficult words

From the learner's notes on two DUO practice exams. Put all of these in vocab
(`source: "learner-notes"`) and in unit `basis-mijn-woorden`. Give them a higher priority in SRS.

het omroepbericht · het buurthuis · tot einde volgende maand · naar een andere plek gebracht ·
de afdeling (afdelingen) · de afdeling inkoop · de bestelling / bestellen · de doos (dozen) ·
het blikje (blikjes) · gebruiken · de cursist · afspreken · binnenkort · trouwen ·
het legitimatiebewijs · kwijt zijn · krijgen · de uitnodiging · het gesprek · de opleiding ·
de leidinggevende · rechtsaf · rechtdoor · de baan · inleveren · de vertraging · vaker ·
de drukste / het drukst · last hebben van · het meeste · de drukte · ingesproken (inspreken) · de klant

---

## 18. Appendix C — KNM fact sheet per theme

Base KNM lessons and questions on these facts. They are stable, well-established facts.
Where a detail changes over time (amounts, exact ages for benefits, party names), describe the
rule without the number, or leave it out. If you add a fact not listed here, it must be
common, verifiable knowledge; prefer leaving it out over guessing.

### C.1 Werk en inkomen
- Werk zoeken: vacatures online, uitzendbureau, netwerk. Solliciteren: brief/e-mail + cv, sollicitatiegesprek.
- Arbeidscontract: tijdelijk of vast; proeftijd; loonstrook (salaris bruto/netto); vakantiegeld (meestal in mei/juni); vakantiedagen.
- Ziek: meteen je werkgever bellen (ziekmelden), volgens de regels van je werk.
- Wettelijk minimumloon bestaat (bedrag verandert — niet noemen).
- Belastingdienst: inkomstenbelasting, belastingaangifte (meestal vóór 1 mei over het vorige jaar), toeslagen (zorgtoeslag, huurtoeslag, kinderopvangtoeslag) — check eigen situatie.
- UWV: werkloosheidsuitkering (WW) na ontslag als je genoeg gewerkt hebt; ook hulp bij werk zoeken en uitkering bij langdurige ziekte.
- Gemeente: bijstand (uitkering als je geen ander inkomen hebt).
- SVB: kinderbijslag, AOW (pensioen van de overheid voor ouderen).
- Zwartwerken (werk zonder belasting te betalen) mag niet.
- Gelijke behandeling: discriminatie op werk mag niet; mannen en vrouwen hebben dezelfde rechten.
- Vakbond: organisatie die opkomt voor werknemers. Ondernemingsraad (OR) in grotere bedrijven.
- Eigen bedrijf beginnen: inschrijven bij de Kamer van Koophandel (KVK).

### C.2 Omgangsvormen, waarden en normen
- Op tijd komen is belangrijk; te laat → even bellen of een bericht sturen.
- Afspraak maken voor bezoek is gewoon (ook bij vrienden/familie vaak).
- Begroeten: hand geven bij kennismaken, iemand aankijken; drie zoenen bij vrienden/familie (niet verplicht).
- u (formeel, onbekenden, oudere mensen, instanties) en je/jij (informeel).
- Direct zijn: Nederlanders zeggen vaak eerlijk wat ze denken.
- Gelijkheid: mannen en vrouwen zijn gelijk; homoseksuele mensen mogen trouwen (sinds 2001).
- Vrijheid van godsdienst en vrijheid van meningsuiting (binnen de wet; discriminatie en bedreigen mogen niet).
- Scheiding van kerk en staat.
- Verjaardag: feliciteren, ook de familie ("Gefeliciteerd met je zoon").
- Buren: kennismaken bij verhuizing, rekening houden met geluid (vooral 's avonds/'s nachts).
- Feestdagen: Koningsdag (27 april), Dodenherdenking (4 mei, 20.00 uur twee minuten stilte), Bevrijdingsdag (5 mei), Sinterklaas (5 december), Kerst (25 en 26 december), Oud en Nieuw, Keti Koti (1 juli, herdenking afschaffing slavernij).
- Afval scheiden en zwerfafval: rommel niet op straat gooien.

### C.3 Wonen
- Huren: sociale huurwoning via een woningcorporatie (vaak wachtlijst) of particuliere verhuurder; huurcontract; borg.
- Huurtoeslag (Belastingdienst) bij laag inkomen en niet te hoge huur.
- Huurder: huur op tijd betalen, kleine reparaties zelf (bijv. kraan, lamp), netjes met het huis omgaan.
- Verhuurder/huisbaas: grote reparaties (dak, verwarming/cv-ketel, lekkage).
- Problemen met de verhuurder over huurprijs of onderhoud → Huurcommissie.
- Verhuizen: binnen 5 dagen doorgeven aan de gemeente (inschrijven in de BRP).
- Vaste lasten: huur, gas/water/licht (energie), internet, gemeentelijke belastingen (afvalstoffenheffing, rioolheffing), waterschapsbelasting.
- Kopen: hypotheek bij een bank.
- Afval scheiden: papier, glas, plastic/pmd, gft (groente, fruit, tuin), restafval; grofvuil ophalen via de gemeente.
- Buren en overlast: eerst praten; daarna eventueel buurtbemiddeling.
- Brand: rookmelder; bij nood 112.

### C.4 Gezondheid en gezondheidszorg
- Zorgverzekering (basisverzekering) is verplicht voor iedereen die in Nederland woont/werkt.
- Eigen risico: een deel van de zorgkosten betaal je zelf per jaar (bedrag niet noemen); huisarts valt er niet onder.
- Zorgtoeslag bij laag inkomen (Belastingdienst).
- Huisarts: eerst naar de huisarts; inschrijven bij een huisarts in de buurt; de huisarts verwijst door naar specialist/ziekenhuis.
- Buiten kantoortijd (avond, nacht, weekend): huisartsenpost — eerst bellen.
- Levensgevaar: 112. Geen spoed maar politie nodig: 0900-8844.
- Apotheek: medicijnen met recept van de huisarts; drogist: zonder recept (paracetamol).
- Tandarts: valt (voor volwassenen) meestal niet in de basisverzekering — eventueel aanvullende verzekering.
- Consultatiebureau (via jeugdgezondheidszorg/GGD): baby's en jonge kinderen — groei, vaccinaties.
- Verloskundige: zwangerschap en bevalling (veel thuis- of poliklinische bevallingen).
- GGD: gezondheid in de regio, vaccinaties.
- Medisch beroepsgeheim: de dokter vertelt niets aan anderen zonder toestemming.
- Afspraak afzeggen: op tijd (vaak minstens 24 uur van tevoren), anders soms betalen.

### C.5 Geschiedenis en geografie
- Nederland: 12 provincies; hoofdstad Amsterdam; regering en parlement in Den Haag.
- Veel land ligt onder zeeniveau; dijken, gemalen, polders; strijd tegen het water.
- Watersnoodramp 1953 (Zeeland) → Deltawerken.
- Rivieren: Rijn, Maas, Waal. Zee: Noordzee. Buurlanden: Duitsland, België.
- Koninkrijk der Nederlanden: Nederland + Aruba, Curaçao, Sint Maarten (landen); Bonaire, Sint Eustatius, Saba (bijzondere gemeenten).
- Gouden Eeuw (17e eeuw): handel, VOC, schilders (Rembrandt). Ook: slavenhandel en slavernij in de koloniën.
- Afschaffing slavernij in Suriname en de Antillen: 1863 (Keti Koti, 1 juli). Suriname onafhankelijk in 1975. Indonesië: voormalige kolonie (onafhankelijk na WO II).
- Willem van Oranje: vader des vaderlands; 80-jarige oorlog tegen Spanje (16e–17e eeuw).
- Tweede Wereldoorlog: Duitse bezetting 1940–1945; Jodenvervolging; Anne Frank (dagboek, Amsterdam). Bevrijding 5 mei 1945.
- Na de oorlog: wederopbouw; gastarbeiders (o.a. uit Turkije, Marokko) in de jaren '60–'70; migratie uit Suriname en Indonesië.
- Nederland was medeoprichter van de Europese Unie (EU/EEG) en lid van de NAVO.
- Euro sinds 2002 (daarvoor gulden).

### C.6 Instanties
| Instantie | Waarvoor |
| --- | --- |
| Gemeente | inschrijven/verhuizen (BRP), paspoort/ID-kaart, rijbewijs, trouwen, bijstand, afval, parkeren, hulp (Wmo) |
| DUO | inburgering (examens, lening), studiefinanciering |
| IND | verblijfsvergunning, naturalisatie (aanvraag via gemeente) |
| UWV | WW-uitkering, werk zoeken, arbeidsongeschiktheid |
| Belastingdienst | belasting, toeslagen |
| SVB | kinderbijslag, AOW |
| Politie | 112 bij spoed, 0900-8844 geen spoed; aangifte doen (bijv. diefstal) |
| Huisarts / huisartsenpost | gezondheid |
| Consultatiebureau / CJG (Centrum voor Jeugd en Gezin) | opvoeden, jonge kinderen |
| Woningcorporatie | sociale huurwoningen |
| Juridisch Loket | gratis informatie over rechtsvragen |
| KVK | eigen bedrijf inschrijven |
| Bibliotheek | boeken lenen, hulp bij taal en computer |
| Vluchtelingenwerk / maatschappelijk werk | begeleiding en hulp |
- DigiD: inloggen bij de overheid (gemeente, Belastingdienst, DUO, UWV). Geef je DigiD nooit aan een ander.
- BSN (burgerservicenummer): persoonlijk nummer, op paspoort/ID-kaart.

### C.7 Staatsinrichting en rechtsstaat
- Nederland is een constitutionele monarchie en een parlementaire democratie. De koning heeft geen politieke macht.
- Koning Willem-Alexander (sinds 2013), koningin Máxima. Prinsjesdag (derde dinsdag van september): troonrede, plannen van de regering.
- Grondwet; artikel 1: gelijke behandeling, discriminatie is verboden.
- Scheiding der machten (trias politica): wetgevende macht (regering + parlement), uitvoerende macht (regering), rechterlijke macht (rechters, onafhankelijk).
- Staten-Generaal: Tweede Kamer (150 leden, direct gekozen, elke 4 jaar) en Eerste Kamer (75 leden).
- Regering = koning + ministers; de minister-president leidt het kabinet. Coalitie: meerdere partijen samen.
- Verkiezingen: vanaf 18 jaar stemmen; Tweede Kamer (Nederlanders), Provinciale Staten, gemeenteraad (ook EU-burgers, en andere niet-Nederlanders na 5 jaar legaal verblijf), waterschap, Europees Parlement. Stemmen is geheim en niet verplicht.
- Gemeente: gemeenteraad (gekozen), burgemeester (benoemd), wethouders (college van B en W).
- Provincie: Provinciale Staten, Gedeputeerde Staten, commissaris van de Koning.
- Rechtsstaat: iedereen moet zich aan de wet houden, ook de overheid. Je bent onschuldig tot het tegendeel bewezen is. Recht op een advocaat.
- Grondrechten: vrijheid van meningsuiting, godsdienst, onderwijs, vereniging; recht op privacy; kiesrecht.
- Kinderen slaan / huiselijk geweld is verboden; hulp: Veilig Thuis.
- Naturalisatie: Nederlander worden — inburgering, aanvraag via gemeente (IND beslist).

### C.8 Onderwijs en opvoeding
- Leerplicht: kinderen moeten naar school van 5 tot 16 jaar (vanaf de eerste schooldag van de maand na hun 5e verjaardag); daarna kwalificatieplicht tot 18 jaar (of tot een startkwalificatie: havo-, vwo- of mbo-2-diploma). Leerplichtambtenaar van de gemeente controleert; ouders kunnen een boete krijgen bij spijbelen.
- Kinderen mogen vanaf 4 jaar naar de basisschool. Basisschool: groep 1–8 (4–12 jaar). Openbaar of bijzonder (bijv. religieus) onderwijs — beide gratis (vrijwillige ouderbijdrage).
- Eind groep 8: schooladvies + doorstroomtoets → voortgezet onderwijs: vmbo (4 jaar), havo (5 jaar), vwo (6 jaar).
- Daarna: mbo (na vmbo), hbo (na havo/mbo-4), universiteit/wo (na vwo).
- Vrij voor school: vakanties (o.a. zomervakantie ~6 weken); vrij nemen buiten de vakanties mag alleen met toestemming van de school.
- Ouders: ouderavond, 10-minutengesprek met de leraar, rapport, medezeggenschapsraad, ouderraad.
- Kinderopvang: kinderdagverblijf (0–4), buitenschoolse opvang (bso); kinderopvangtoeslag.
- Peuterspeelzaal / voorschool: voorbereiding op school, taalontwikkeling.
- Opvoeding: kinderen leren zelfstandig zijn en hun mening geven; slaan mag niet.
- Studiefinanciering voor mbo/hbo/wo via DUO.
- Volwassenen: inburgeringscursus, taalcursus, bibliotheek, mbo-opleidingen.

---

## 19. Appendix D — Schrijven templates and phrase bank

### D.1 Formal e-mail / letter

```
Geachte heer [achternaam], / Geachte mevrouw [achternaam], / Geachte heer, mevrouw,

[Waarom schrijf ik? 1 zin]  Ik schrijf u omdat …
[Punt 1]
[Punt 2]
[Punt 3 / vraag]  Kunt u mij laten weten …?

Met vriendelijke groet,

[Voornaam Achternaam]
[Adres, telefoonnummer — als gevraagd]
```

Phrases: Ik schrijf u omdat … · Ik wil graag een afspraak maken. · Ik wil mijn afspraak afzeggen. ·
Ik heb een vraag over … · Helaas … · Het probleem is dat … · Kunt u mij laten weten wanneer …? ·
Kunt u … repareren / opsturen / terugbellen? · Ik ben bereikbaar op 06-… · Alvast bedankt voor uw hulp. ·
Ik hoop snel iets van u te horen.

### D.2 Informal e-mail / message

```
Hoi [naam], / Beste [naam],

[Waarom schrijf ik?]
[Punt 1]
[Punt 2]
[Punt 3 / vraag]

Groetjes, / Groeten, / Tot snel!
[Voornaam]
```

Phrases: Hoe gaat het met je? · Ik wil je uitnodigen voor … · Heb je zin om …? · Bedankt voor … ·
Sorry, ik kan niet komen, want … · Zullen we … afspreken? · Laat je het even weten? · Tot zaterdag!

### D.3 Short note (briefje)

```
Beste buren, / Hallo [naam],

[Wat is er? Wat vraag je? Wanneer?]

Groeten,
[Naam, huisnummer]
```

Example: *Beste buren, zaterdag geef ik een feestje voor mijn verjaardag. Het kan een beetje
druk zijn. Het feest is om 23.00 uur klaar. Sorry voor het lawaai! Groeten, Olga (nr. 14)*

### D.4 Forms

Fields: voornaam, achternaam, geslacht (man/vrouw/anders), geboortedatum (dd-mm-jjjj), geboorteplaats,
nationaliteit, burgerlijke staat (ongehuwd/gehuwd/gescheiden), adres (straat + huisnummer),
postcode (1234 AB), woonplaats, telefoonnummer, e-mailadres, BSN, datum, handtekening.
Short-answer patterns: "Waarom wilt u lid worden?" → *Ik wil graag sporten en nieuwe mensen leren kennen.*

### D.5 Exam checklist (show at the end of every writing task)

1. Heb ik alle punten van de opdracht beantwoord?
2. Aanhef en afsluiting goed (formeel of informeel)?
3. u of je — past het bij de lezer?
4. Werkwoord op plek 2? In een bijzin werkwoord aan het eind?
5. Hoofdletter aan het begin, punt aan het eind?
6. Genoeg woorden (en niet te veel)?
7. Duidelijk geschreven (op het examen schrijf je met pen)?
