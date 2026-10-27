import { afterEach, describe, expect, it, vi } from "vitest";

/** A Web Audio stand-in: every node accepts any call; params and buffers are plain objects. */
function fakeNode(): any {
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {}, cancelScheduledValues() {} });
  return new Proxy({} as Record<string, unknown>, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (["gain", "frequency", "Q", "pan", "threshold", "ratio", "attack", "release"].includes(key)) return (target[key] = param());
      if (key === "connect") return (n: unknown) => n;
      return () => {};
    },
    set(target, key: string, v) {
      target[key] = v;
      return true;
    },
  });
}

class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state = "suspended";
  currentTime = 0;
  sampleRate = 8000;
  destination = fakeNode();
  resume = vi.fn(() => Promise.resolve());
  constructor() {
    FakeAudioContext.instances.push(this);
  }
  createBuffer(_ch: number, len: number) {
    return { getChannelData: () => new Float32Array(len) };
  }
}
for (const m of ["createGain", "createDynamicsCompressor", "createConvolver", "createStereoPanner", "createOscillator", "createBiquadFilter", "createBufferSource"])
  (FakeAudioContext.prototype as any)[m] = () => fakeNode();

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  FakeAudioContext.instances = [];
});

describe("answer sounds on iPhone", () => {
  it("leave the iOS audio session alone (\"playback\" silenced them) and wake the context", async () => {
    const audioSession = { type: "auto" };
    vi.stubGlobal("AudioContext", FakeAudioContext);
    vi.stubGlobal("navigator", { audioSession });
    const { playCorrect } = await import("../../src/lib/sound");

    playCorrect();

    expect(audioSession.type).toBe("auto");
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(FakeAudioContext.instances[0].resume).toHaveBeenCalled();
  });

  it("resume a context iOS interrupted (after a call or Siri)", async () => {
    vi.stubGlobal("AudioContext", FakeAudioContext);
    const { playCorrect, playWrong } = await import("../../src/lib/sound");
    playCorrect();
    const c = FakeAudioContext.instances[0];
    c.state = "interrupted";
    c.resume.mockClear();

    playWrong();

    expect(c.resume).toHaveBeenCalled();
  });
});
