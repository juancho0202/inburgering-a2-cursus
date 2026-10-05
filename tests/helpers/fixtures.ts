import type { Content } from "../../shared/content/types";
import type { ClaudeGateway } from "../../shared/claude/gateway";
import { createMemoryStore } from "../../shared/store/memory";
import type { Env } from "../../shared/services/context";
import type { Exam, Exercise, Unit } from "../../shared/types";

const mc = (id: string, tags: string[], answer = 0): Exercise => ({
  id, type: "mc", tags, prompt: `Vraag ${id}`, options: ["goed", "fout", "ook fout"], answer, explanation: "Uitleg.", difficulty: 1,
});

const writing = (id: string, tag: string): Exercise => ({
  id, type: "writing", tags: [tag], prompt: "Schrijf een bericht.", explanation: "e", difficulty: 1,
  task: { instructions: "Schrijf aan je buur.", scenario: "Je geeft een feestje.", requiredPoints: ["Vertel wat", "Vertel wanneer"] },
  minWords: 10, maxWords: 50, modelAnswer: "Voorbeeld", checklist: ["Aanhef"], register: "informal",
});

const reading = (id: string): Exercise => ({
  id, type: "reading", tags: ["lezen:brief"], prompt: "Lees.", explanation: "e", difficulty: 1,
  document: { kind: "document", docType: "brief", title: "Brief", body: "Tekst" },
  questions: [mc(`${id}-1`, ["lezen:brief"]), mc(`${id}-2`, ["lezen:brief"], 1)],
});

const unitA: Unit = {
  id: "basis-a", moduleId: "basis", title: "Les A", goal: "Doel A", estimatedMinutes: 10, tags: ["basis:a"], vocabRefs: ["v-huur", "v-werken"], passScore: 0.7,
  steps: [
    { type: "lesson", id: "basis-a-l-01", title: "Uitleg", blocks: [{ kind: "text", md: "Hoi" }] },
    { type: "exercise", exercise: mc("basis-a-q-001", ["basis:a"]) },
    { type: "exercise", exercise: mc("basis-a-q-002", ["basis:a"]) },
    { type: "exercise", exercise: mc("basis-a-q-003", ["grammar:x"]) },
  ],
};
const unitB: Unit = {
  id: "knm-wonen", moduleId: "knm", title: "Wonen", goal: "Doel B", estimatedMinutes: 10, tags: ["knm:wonen"], vocabRefs: [], passScore: 0.7,
  steps: [{ type: "exercise", exercise: mc("knm-wonen-q-001", ["knm:wonen"]) }, { type: "exercise", exercise: reading("knm-wonen-q-002") }],
};
const unitW: Unit = {
  id: "schrijven-kort", moduleId: "schrijven", title: "Kort bericht", goal: "Doel W", estimatedMinutes: 10, tags: ["schrijven:kort-bericht"], vocabRefs: [], passScore: 0.7,
  steps: [{ type: "exercise", exercise: writing("schrijven-kort-q-001", "schrijven:kort-bericht") }],
};

const examKnm: Exam = {
  id: "exam-knm-t", skill: "knm", title: "Proef KNM", durationMinutes: 45, passScore: 0.7,
  items: [mc("exam-knm-t-q-001", ["knm:wonen"]), mc("exam-knm-t-q-002", ["knm:wonen"]), mc("exam-knm-t-q-003", ["knm:werk"])],
};
const examSchrijven: Exam = {
  id: "exam-schrijven-t", skill: "schrijven", title: "Proef Schrijven", durationMinutes: 40, passScore: 0.7,
  items: [
    { id: "exam-schrijven-t-q-001", type: "form-fill", tags: ["schrijven:formulier"], prompt: "Vul in.", explanation: "e", difficulty: 1, formTitle: "Formulier", scenario: "Je heet Amira.",
      fields: [{ label: "Naam", kind: "text", expected: "Amira" }, { label: "Plaats", kind: "text", expected: "Utrecht" }] },
    writing("exam-schrijven-t-q-002", "schrijven:informeel"),
  ],
};

export function fixtureContent(): Content {
  const units = new Map([unitA, unitB, unitW].map((u) => [u.id, u]));
  const entries = [
    { id: "v-huur", nl: "de huur", article: "de" as const, pos: "noun" as const, plural: null, definitionNl: "Geld voor je huis.", example: "De huur is hoog.", tags: [], level: "A2" as const, source: "course" as const },
    { id: "v-lamp", nl: "de lamp", article: "de" as const, pos: "noun" as const, plural: null, definitionNl: "Geeft licht.", example: "De lamp is kapot.", tags: [], level: "A2" as const, source: "course" as const },
    { id: "v-werken", nl: "werken", article: null, pos: "verb" as const, plural: null, definitionNl: "Je doet je baan.", example: "Ik werk.", tags: [], level: "A2" as const, source: "course" as const },
  ];
  return {
    version: "test0001",
    course: { id: "t", title: "Test" },
    modules: new Map([
      ["basis", { id: "basis", title: "Basis", description: "d", icon: "book", units: ["basis-a"] }],
      ["knm", { id: "knm", title: "KNM", description: "d", icon: "landmark", units: ["knm-wonen"] }],
      ["schrijven", { id: "schrijven", title: "Schrijven", description: "d", icon: "pencil", units: ["schrijven-kort"] }],
    ]),
    units,
    vocabByTheme: new Map([["wonen", { theme: "wonen", title: "Wonen", entries }]]),
    vocabById: new Map(entries.map((e) => [e.id, e])),
    verbs: new Map([
      ["v-werken", { id: "v-werken", infinitive: "werken", separable: false, prefix: null, present: { ik: "werk", jij: "werkt", hij: "werkt", wij: "werken" }, past: { sg: "werkte", pl: "werkten" }, participle: "gewerkt", auxiliary: "hebben" as const, irregular: false, definitionNl: "d", example: "e" }],
    ]),
    exams: new Map([examKnm, examSchrijven].map((e) => [e.id, e])),
    samenvatting: "# Samenvatting",
    facts: new Map([["knm-wonen", "- Feit over wonen"]]),
  };
}

/** A clock the test can move. */
export function makeClock(start = "2026-10-05T10:00:00") {
  let t = new Date(start).getTime();
  return { now: () => new Date(t), advanceMs: (ms: number) => (t += ms), advanceDays: (d: number) => (t += d * 86_400_000), set: (iso: string) => (t = new Date(iso).getTime()) };
}

export function makeEnv(opts: { gateway?: () => ClaudeGateway; content?: Content; clock?: ReturnType<typeof makeClock> } = {}) {
  const clock = opts.clock ?? makeClock();
  let n = 0;
  const env: Env = {
    store: createMemoryStore(),
    content: opts.content ?? fixtureContent(),
    now: clock.now,
    newId: () => `id-${++n}`,
    random: () => 0.5,
    gateway: opts.gateway,
  };
  return { env, clock };
}

/** Fake Claude: returns what `reply` gives for each call (JSON-stringified), and records the calls. */
export function fakeGateway(reply: (call: { system: string; user: string; schema: Record<string, any> }) => unknown) {
  const calls: { system: string; user: string }[] = [];
  const gateway: ClaudeGateway = {
    async complete(args) {
      calls.push({ system: args.system, user: args.user });
      const out = reply({ system: args.system, user: args.user, schema: args.schema as Record<string, any> });
      return { text: typeof out === "string" ? out : JSON.stringify(out), usage: { inputTokens: 100, outputTokens: 50 } };
    },
  };
  return { gateway, calls };
}
