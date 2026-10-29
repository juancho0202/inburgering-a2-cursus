// The recorded voice (scripts/tts). A line without a clip is read by the device's own voice, and a device without a
// Dutch voice says nothing at all: adding lesson 1 to Basis once left the whole module silent for those learners.
import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { spokenLines } from "../../scripts/tts/lines";
import { realContent } from "../helpers/realContent";

const manifest = (dir: "voice" | "fragments") => JSON.parse(fs.readFileSync(new URL(`../../public/audio/${dir}/manifest.json`, import.meta.url), "utf8"));
const RECORD = "not recorded: run `npm run voice` (scripts/tts/README.md)";

describe("recorded voice", () => {
  it("has a clip for every line the course reads aloud", async () => {
    const { texts } = spokenLines(await realContent());
    const recorded = new Set<string>(manifest("voice").keys);
    const missing = [...texts].filter(([key]) => !recorded.has(key)).map(([key, { voice, text }]) => `${key} ${voice}: ${text.slice(0, 70)}`);
    expect(missing, RECORD).toEqual([]);
  });

  it("has a recording for every listening fragment", async () => {
    const { fragments } = spokenLines(await realContent());
    const recorded = new Set(Object.keys(manifest("fragments").fragments));
    expect([...fragments.keys()].filter((key) => !recorded.has(key)), RECORD).toEqual([]);
  });
});
