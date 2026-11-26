"""
How well the sound checks work, measured on this course's own lines (scripts/tts/README.md, "Calibration").

For a random sample of lines it records a clean take, and the same take with a known fault put in:
  muted      one word made silent
  swapped    one word replaced by a word of another line (same length, so the rest keeps its timing)
  truncated  the take cut off in its last word
  noisy      the line said with far too much noise (Piper's noise 1.6 and noise_w 2.0: it mumbles and drags)
and reports how often the checks (pronunciation/checks.py, as `npm run voice` runs them) find the fault in the right
word, and how often they find an error in a clean take. Run it after changing a threshold, a voice or the listener:

  .tts/piper-venv/bin/python -I scripts/tts/calibrate.py [--lines 100]
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from pronunciation.checks import check_heard, check_timing  # noqa: E402
from pronunciation.listener import Listener  # noqa: E402
from pronunciation.seeded import Scales, SeededVoice, Take, seed_for  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
TTS = ROOT / ".tts"


def errors(listener: Listener, take: Take, audio: np.ndarray, pace: float) -> list:
    plans = [s.plan for s in take.sentences]
    found = check_timing(plans, take.timings(), pace) + check_heard(listener, listener.hear(audio, take.sample_rate), plans, take.timings())
    return [f for f in found if f.severity == "error"]


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--lines", type=int, default=100)
    p.add_argument("--pace", type=float, default=1.1)
    p.add_argument("--seed", type=int, default=1)
    args = p.parse_args()

    rng = np.random.default_rng(args.seed)
    lines = [l for l in json.loads((TTS / "texts.json").read_text()) if 3 <= len(l["text"].split()) <= 30]
    sample = [lines[i] for i in rng.choice(len(lines), min(args.lines, len(lines)), replace=False)]
    listener = Listener(TTS / "listener")
    voices: dict[str, SeededVoice] = {}
    hits: dict[str, list[bool]] = {k: [] for k in ("clean", "muted", "swapped", "truncated", "noisy")}

    def take_of(line: dict, take: int = 0, scales: Scales | None = None) -> Take:
        v = voices.get(line["model"]) or voices.setdefault(line["model"], SeededVoice(TTS / "voices" / f"{line['model']}.onnx"))
        return v.say(v.planner.plan(line["input"], line["text"]), seed_for(line["key"], take), scales or Scales(args.pace))

    def words(take: Take) -> list[tuple[str, int, int]]:
        """Each word of a take with its samples; only words of 3+ letters and 0.15 s, so a fault is clearly there."""
        out = [(w.text, *s.span(w.start, w.end)) for s in take.sentences for w in s.plan.words]
        return [(t, a, b) for t, a, b in out if len(t) >= 3 and b - a > 0.15 * take.sample_rate]

    for n, line in enumerate(sample, 1):
        take = take_of(line)
        hits["clean"].append(bool(errors(listener, take, take.audio, args.pace)))
        candidates = words(take)
        if candidates:
            word, a, b = candidates[int(rng.integers(len(candidates)))]
            muted = take.audio.copy()
            muted[a:b] = rng.standard_normal(b - a).astype(np.float32) * 0.002
            hits["muted"].append(word in {f.word for f in errors(listener, take, muted, args.pace)})
            other = take_of(sample[n % len(sample)])
            pieces = [(t, a2, b2) for t, a2, b2 in words(other) if t.lower() != word.lower()]
            if pieces:
                _, a2, b2 = pieces[0]
                piece = other.audio[a2:b2][: b - a]
                swapped = take.audio.copy()
                swapped[a:b] = np.concatenate([piece, np.zeros(b - a - len(piece), dtype=np.float32)])
                hits["swapped"].append(word in {f.word for f in errors(listener, take, swapped, args.pace)})
            last, a, b = max(candidates, key=lambda c: c[2])
            found = errors(listener, take, take.audio[: a + int(0.4 * (b - a))], args.pace)
            hits["truncated"].append(any(f.word in (last, "") for f in found))
        noisy = take_of(line, 9, Scales(args.pace, noise=1.6, noise_w=2.0))
        hits["noisy"].append(bool(errors(listener, noisy, noisy.audio, args.pace)))
        if n % 10 == 0:
            print(f"[{n}/{len(sample)}]", flush=True)

    print(f"{'take':22} {'lines':>5}  {'found':>6}")
    for kind, found in hits.items():
        label = "clean (false alarms)" if kind == "clean" else kind
        print(f"{label:22} {len(found):5}  {np.mean(found):6.1%}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
