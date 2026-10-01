import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { z } from "zod";
import { readJson, writeJson } from "../../server/db/fileStore.js";

const schema = z.object({ value: z.number() });

describe("fileStore", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), "filestore-test-"));
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  it("writes and reads back JSON atomically", async () => {
    const file = path.join(dir, "data.json");
    await writeJson(file, { value: 42 });
    const result = await readJson(file, schema, { value: 0 });
    expect(result.value).toBe(42);
  });

  it("returns and writes fallback when file is missing", async () => {
    const file = path.join(dir, "missing.json");
    const result = await readJson(file, schema, { value: 7 });
    expect(result.value).toBe(7);
    const raw = JSON.parse(await fs.readFile(file, "utf-8"));
    expect(raw.value).toBe(7);
  });

  it("quarantines a corrupt file and returns fallback", async () => {
    const file = path.join(dir, "corrupt.json");
    await fs.writeFile(file, "{ not valid json", "utf-8");
    const result = await readJson(file, schema, { value: 1 });
    expect(result.value).toBe(1);
    const entries = await fs.readdir(dir);
    expect(entries.some((e) => e.startsWith("corrupt.corrupt-"))).toBe(true);
  });

  it("serialises concurrent writes to the same file via the write queue", async () => {
    const file = path.join(dir, "queued.json");
    await Promise.all(Array.from({ length: 20 }, (_, i) => writeJson(file, { value: i })));
    const result = await readJson(file, schema, { value: -1 });
    expect(typeof result.value).toBe("number");
  });
});
