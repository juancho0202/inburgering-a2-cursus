import { describe, expect, it } from "vitest";
import { progressFileName } from "../../src/lib/progressFile";

describe("progress file name", () => {
  const day = new Date("2026-10-05T20:00:00Z");
  it("has the date and a safe device name", () => {
    expect(progressFileName("Laptop", day)).toBe("inburgering-a2-voortgang-2026-10-05-laptop.json");
    expect(progressFileName("iPhone van Fátima!", day)).toBe("inburgering-a2-voortgang-2026-10-05-iphone-van-fatima.json");
  });
  it("works without a device name", () => {
    expect(progressFileName(null, day)).toBe("inburgering-a2-voortgang-2026-10-05.json");
    expect(progressFileName("   ", day)).toBe("inburgering-a2-voortgang-2026-10-05.json");
  });
});
