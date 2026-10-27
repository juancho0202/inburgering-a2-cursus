import { describe, expect, it } from "vitest";
import { exerciseAnnouncement, stepAnnouncement, stepSegments } from "../../src/lib/announce";
import { lessonTune, playCorrect, playLessonMelody } from "../../src/lib/sound";
import { speakable } from "../../src/lib/announce";

const base = { id: "x", tags: [], explanation: "", difficulty: 1 as const };

describe("voice announcements", () => {
  it("reads the sentence of gap and true/false exercises, not just the instruction", () => {
    expect(exerciseAnnouncement({ ...base, type: "gap-fill", prompt: "Maak de vergrotende trap (groot).", text: "Mijn broer is ___ dan ik.", answers: [["groter"]] }))
      .toBe("Maak de vergrotende trap (groot). Mijn broer is ___ dan ik.");
    expect(exerciseAnnouncement({ ...base, type: "true-false", prompt: "Klopt dit?", statement: "Half acht is 8.30.", answer: false }))
      .toBe("Klopt dit? Half acht is 8.30.");
  });

  it("names the lesson on the first step only", () => {
    const step = { type: "lesson" as const, id: "l", title: "De of het?", blocks: [] };
    expect(stepAnnouncement(step, { first: true, unitTitle: "De of het", lessonNumber: 11 })).toBe("Les 11. De of het. De of het?");
    expect(stepAnnouncement(step, { first: false, unitTitle: "De of het", lessonNumber: 11 })).toBe("De of het?");
    expect(stepAnnouncement({ ...step, title: "De of het" }, { first: true, unitTitle: "De of het", lessonNumber: 11 })).toBe("Les 11. De of het.");
  });

  it("reads the goal and the readable blocks of a lesson step, in order", () => {
    const step = {
      type: "lesson" as const,
      id: "l",
      title: "Hoe laat is het?",
      blocks: [
        { kind: "text" as const, md: "Je zegt **half acht**." },
        { kind: "table" as const, headers: ["a"], rows: [["b"]] },
        { kind: "tip" as const, md: "Oefen hardop." },
      ],
    };
    const segs = stepSegments(step, { first: false, unitTitle: "Tijd", goal: "Je leert de tijd." });
    expect(segs.map((s) => s.id)).toEqual(["heading", "goal", "block-0", "block-2"]);
    expect(segs[3].text).toBe("Tip: Oefen hardop.");
  });

  it("gives list items and lines their own pause", () => {
    expect(speakable("Je ziet:\n- de bus\n- de trein")).toBe("Je ziet: de bus. de trein");
  });

  it("turns gaps and markdown into speakable text", () => {
    expect(speakable("Vaak **het**: *het gesprek*, ___ blikje")).toBe("Vaak het: het gesprek, … blikje");
  });
});

describe("lesson tunes", () => {
  it("are the same every time for a lesson number and differ between numbers", () => {
    expect(lessonTune(3)).toEqual(lessonTune(3));
    const tunes = new Set(Array.from({ length: 16 }, (_, i) => JSON.stringify(lessonTune(i + 1))));
    expect(tunes.size).toBe(16);
  });

  it("fit in two bars and play the melody in order", () => {
    for (let n = 1; n <= 16; n++) {
      const pos = lessonTune(n).melody.map(([p]) => p);
      expect(pos.every((p, i) => p >= 0 && p < 16 && (i === 0 || p > pos[i - 1]))).toBe(true);
    }
  });

  it("do nothing without Web Audio", () => {
    expect(() => playCorrect()).not.toThrow();
    expect(playLessonMelody(1, 0)).toBe(0);
  });
});
