import { describe, expect, it } from "vitest";
import { collectFlags, formatFlags } from "../../scripts/flagsReport";
import { addFlag, flagTarget, listFlags, removeFlag } from "../../shared/services/flags";
import { newIssueUrl } from "../../src/lib/github";
import { applyImport, buildProgressFile } from "../../shared/services/transfer";
import { createApiRouter } from "../../shared/services/router";
import { makeEnv } from "../helpers/fixtures";

describe("Meld een fout", () => {
  it("saves a note with a title for lessons, exercises, reading questions and exam questions", async () => {
    const { env } = makeEnv();
    await addFlag(env, { itemId: "basis-a-q-001", note: "Twee goede antwoorden." });
    await addFlag(env, { itemId: "basis-a-l-01", note: "" });
    await addFlag(env, { itemId: "knm-wonen-q-002-1", note: "Onduidelijk." });
    await addFlag(env, { itemId: "exam-knm-t-q-001", note: "Fout antwoord." });
    await addFlag(env, { itemId: "bestaat-niet", note: "?" });
    const list = await listFlags(env);
    const titles = Object.fromEntries(list.map((f) => [f.itemId, f.title]));
    expect(titles).toEqual({
      "basis-a-q-001": "Vraag basis-a-q-001",
      "basis-a-l-01": "Les: Uitleg",
      "knm-wonen-q-002-1": "Vraag knm-wonen-q-002-1",
      "exam-knm-t-q-001": "Vraag exam-knm-t-q-001",
      "bestaat-niet": "bestaat-niet",
    });
  });

  it("validates input and can remove a note", async () => {
    const { env } = makeEnv();
    await expect(addFlag(env, { itemId: "", note: "x" })).rejects.toMatchObject({ code: "invalid_body", message: "Je melding kon niet worden bewaard." });
    await expect(addFlag(env, { itemId: "q", note: "x".repeat(501) })).rejects.toMatchObject({ code: "invalid_body" });
    const flag = await addFlag(env, { itemId: "q", note: "  kort  " });
    expect(flag.note).toBe("kort");
    await removeFlag(env, flag.id);
    expect(await listFlags(env)).toEqual([]);
  });

  it("works through the router and travels in the progress file (union on merge)", async () => {
    const laptop = makeEnv().env;
    const phone = makeEnv().env;
    laptop.newId = () => `l-${Math.random()}`;
    phone.newId = () => `p-${Math.random()}`;
    await createApiRouter(async () => phone).handle("POST", "/flags", { itemId: "basis-a-q-001", note: "Van de telefoon" });
    await addFlag(laptop, { itemId: "basis-a-q-002", note: "Van de laptop" });
    await applyImport(laptop, { file: await buildProgressFile(phone) });
    expect((await listFlags(laptop)).map((f) => f.note).sort()).toEqual(["Van de laptop", "Van de telefoon"]);
    expect((await applyImport(laptop, { file: await buildProgressFile(phone) })).nothingNew).toBe(true);
  });

  it("the report script collects notes from several files without duplicates, and lists them per item", async () => {
    const a = makeEnv().env;
    const b = makeEnv().env;
    a.newId = () => "same-id-" + Math.random();
    b.newId = () => "other-" + Math.random();
    const f1 = await addFlag(a, { itemId: "basis-a-q-001", note: "Eerste" });
    await addFlag(b, { itemId: "basis-a-q-001", note: "Tweede" });
    await addFlag(b, { itemId: "knm-wonen-q-001", note: "Derde" });
    const fileA = JSON.parse(JSON.stringify(await buildProgressFile(a)));
    const fileB = JSON.parse(JSON.stringify(await buildProgressFile(b)));
    const flags = collectFlags([fileA, fileB, fileA]); // fileA twice
    expect(flags).toHaveLength(3);
    expect(flags.find((f) => f.id === f1.id)).toBeTruthy();
    const text = formatFlags(flags, a.content);
    expect(text).toContain("3 melding(en) over 2 onderdeel/onderdelen");
    expect(text).toContain("## basis-a-q-001");
    expect(text).toContain("Vraag basis-a-q-001");
    expect(text).toContain("Eerste");
    expect(formatFlags([], a.content)).toBe("Geen meldingen gevonden.");
  });

  it("finds the course file of lessons, exercises, reading questions and exam questions", async () => {
    const { env } = makeEnv();
    const file = (id: string) => flagTarget(env, id).source?.file ?? null;
    expect(file("basis-a-l-01")).toBe("basis/units/basis-a.json");
    expect(file("basis-a-q-001")).toBe("basis/units/basis-a.json");
    expect(file("knm-wonen-q-002-1")).toBe("knm/units/knm-wonen.json");
    expect(file("exam-knm-t-q-001")).toBe("exams/exam-knm-t.json");
    expect(file("gen-basis-a-1-1")).toBeNull();
    const res = await createApiRouter(async () => env).handle("GET", "/flags/target/basis-a-l-01");
    expect(res.body).toEqual({ itemId: "basis-a-l-01", source: { file: "basis/units/basis-a.json", title: "Les: Uitleg" } });
  });

  it("builds a GitHub link that fills in the issue form", () => {
    const url = new URL(newIssueUrl({ itemId: "basis-a-q-001", file: "basis/units/basis-a.json", title: "Wat is & goed?", note: "  Twee goede antwoorden. " }));
    expect(url.origin + url.pathname).toBe("https://github.com/juancho0202/inburgering-a2-cursus/issues/new");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      template: "inhoud-fout.yml",
      title: "Fout in basis-a-q-001",
      onderdeel: "basis-a-q-001",
      bestand: "https://github.com/juancho0202/inburgering-a2-cursus/blob/main/data/course/basis/units/basis-a.json",
      vraag: "Wat is & goed?",
      toelichting: "Twee goede antwoorden.",
    });
  });
});
