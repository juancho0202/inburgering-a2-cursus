import { describe, expect, it } from "vitest";
import { collectFlags, formatFlags } from "../../scripts/flagsReport";
import { addFlag, listFlags, removeFlag } from "../../shared/services/flags";
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
});
