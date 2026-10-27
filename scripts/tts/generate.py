"""
Records the lesson voices and the listening fragments with Piper (open source, runs offline; see scripts/tts/README.md).

Reads .tts/texts.json (made by scripts/tts/export-texts.ts: each line with the voice of its lesson) and writes one
AAC clip per line to public/audio/voice/<key>.m4a plus public/audio/voice/manifest.json.
Reads .tts/fragments.json (each listening fragment: its kind and lines, each with a voice) and writes one recording per
fragment to public/audio/fragments/<key>.m4a plus public/audio/fragments/manifest.json, which says where each line
starts (the app highlights the line being said and jumps to a line).
Files that exist are kept, so only new or changed lines and fragments are recorded on a rerun; unused ones are removed.
Use `npm run voice`, which runs this without network access.

  .tts/piper-venv/bin/python -I scripts/tts/generate.py [--only 5] [--out dir] [--fragments-out dir] [--force] [--pace 1.1]
"""

import argparse
import io
import json
import subprocess
import sys
import tempfile
import time
import wave
from pathlib import Path

import numpy as np
from piper import PiperVoice, SynthesisConfig

ROOT = Path(__file__).resolve().parents[2]
VOICES = ROOT / ".tts" / "voices"
SR = 22050  # every Piper "medium" voice


def encode(wav: Path, out: Path) -> None:
    # macOS's own encoder: mono AAC, small and playable in every browser.
    subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "32000", "-c", "1", str(wav), str(out)], check=True)


class Voices:
    def __init__(self, pace: float):
        self.models: dict[str, PiperVoice] = {}
        self.pace = pace

    def synth(self, model_name: str, text: str, speaker: int | None = None) -> bytes:
        """One line as WAV bytes."""
        model = self.models.get(model_name)
        if model is None:
            model = self.models[model_name] = PiperVoice.load(VOICES / f"{model_name}.onnx")
        buf = io.BytesIO()
        with wave.open(buf, "wb") as w:
            model.synthesize_wav(text, w, syn_config=SynthesisConfig(speaker_id=speaker, length_scale=self.pace))
        return buf.getvalue()

    def samples(self, model_name: str, text: str) -> np.ndarray:
        with wave.open(io.BytesIO(self.synth(model_name, text))) as r:
            assert r.getframerate() == SR, f"{model_name} is not {SR} Hz"
            return np.frombuffer(r.readframes(r.getnframes()), dtype=np.int16).astype(np.float32) / 32768


# ---------- the sound around a fragment ----------


def silence(seconds: float) -> np.ndarray:
    return np.zeros(int(SR * seconds), dtype=np.float32)


def tone(freq: float, seconds: float, amp: float, fade: float = 0.02) -> np.ndarray:
    t = np.arange(int(SR * seconds)) / SR
    env = np.clip(np.minimum(t / fade, (seconds - t) / fade), 0, 1)
    return (amp * np.sin(2 * np.pi * freq * t) * env).astype(np.float32)


def bell(freq: float, seconds: float, amp: float) -> np.ndarray:
    """A soft struck bell: a few partials that die away."""
    t = np.arange(int(SR * seconds)) / SR
    env = np.exp(-t * 3.2) * np.clip(t / 0.005, 0, 1)
    partials = [(1, 1.0), (2, 0.35), (3, 0.12), (4.2, 0.05)]
    return (amp * env * sum(a * np.sin(2 * np.pi * freq * m * t) for m, a in partials)).astype(np.float32)


def mix(parts: list[tuple[float, np.ndarray]], seconds: float) -> np.ndarray:
    out = silence(seconds)
    for at, x in parts:
        i = int(SR * at)
        out[i : i + len(x)] += x[: len(out) - i]
    return out


def ringback() -> np.ndarray:
    """The Dutch ringing tone (425 Hz, 1 s on), twice, shortened pauses: someone is calling."""
    on = tone(425, 1.0, 0.12)
    return np.concatenate([silence(0.3), on, silence(1.2), on, silence(0.7)])


def voicemail_beep() -> np.ndarray:
    return np.concatenate([silence(0.3), tone(1000, 0.45, 0.12), silence(0.6)])


def chime() -> np.ndarray:
    """Three falling notes before an announcement (a generic chime, not any company's)."""
    notes = [(0.0, 784), (0.42, 659), (0.84, 523)]
    return np.concatenate([silence(0.2), mix([(at, bell(f, 1.6, 0.16)) for at, f in notes], 2.4), silence(0.2)])


def jingle() -> np.ndarray:
    """A short rising radio sting."""
    notes = [(0.0, 523), (0.11, 659), (0.22, 784), (0.33, 1047)]
    return np.concatenate([silence(0.2), mix([(at, bell(f, 1.1, 0.13)) for at, f in notes], 1.5), silence(0.3)])


LEAD_IN = {"telefoon": ringback, "voicemail": voicemail_beep, "omroep": chime, "radio": jingle}


def fft_filter(x: np.ndarray, gain) -> np.ndarray:
    n = len(x)
    f = np.fft.rfftfreq(n, 1 / SR)
    return np.fft.irfft(np.fft.rfft(x) * gain(np.maximum(f, 1.0)), n).astype(np.float32)


def phone(x: np.ndarray) -> np.ndarray:
    """Through a telephone: roughly 300-3400 Hz and a little grit. Gentle, so it stays easy to understand."""
    y = fft_filter(x, lambda f: 1 / np.sqrt(1 + (280 / f) ** 4) / np.sqrt(1 + (f / 3600) ** 8))
    return (np.tanh(y * 1.8) / np.tanh(1.8)).astype(np.float32)


def loudspeaker(x: np.ndarray) -> np.ndarray:
    """A public address system: less bass and less top, then a small hall."""
    y = fft_filter(x, lambda f: 1 / np.sqrt(1 + (220 / f) ** 4) / np.sqrt(1 + (f / 6000) ** 6))
    rt = 0.9  # seconds until the echo has died away
    t = np.arange(int(SR * rt)) / SR
    ir = np.random.default_rng(7).standard_normal(len(t)) * np.exp(-6.9 * t / rt)
    ir[: int(SR * 0.025)] = 0  # the first reflection comes a little later
    ir /= np.sqrt((ir**2).sum())
    n = 1 << int(np.ceil(np.log2(len(y) + len(ir))))
    wet = np.fft.irfft(np.fft.rfft(y, n) * np.fft.rfft(ir, n), n)[: len(y)]
    return (y + 0.2 * wet).astype(np.float32)


def trim(x: np.ndarray, threshold: float = 0.01) -> np.ndarray:
    """Without the silence Piper leaves around a line (the pauses are set here)."""
    loud = np.where(np.abs(x) > threshold)[0]
    if len(loud) == 0:
        return x
    pad = int(SR * 0.03)
    return x[max(0, loud[0] - pad) : loud[-1] + pad]


def level(x: np.ndarray, rms: float = 0.11) -> np.ndarray:
    """The same loudness for every voice (they differ a lot), without clipping."""
    current = float(np.sqrt(np.mean(x**2))) or 1.0
    y = x * (rms / current)
    peak = float(np.max(np.abs(y))) or 1.0
    return y * min(1.0, 0.95 / peak)


def render_fragment(voices: Voices, fragment: dict) -> tuple[np.ndarray, list[float]]:
    """The whole fragment as samples, and the time (s) each line starts."""
    kind = fragment["kind"]
    parts: list[np.ndarray] = [LEAD_IN[kind]() if kind in LEAD_IN else silence(0.4)]
    starts: list[float] = []
    pos = len(parts[0])
    previous_model = None
    for line in fragment["lines"]:
        x = level(trim(voices.samples(line["model"], line["text"])))
        if line["phone"]:
            x = level(phone(x))
        if previous_model is not None:
            # A new speaker takes a breath longer; an announcement or a message runs on calmly.
            gap = silence(0.6 if line["model"] != previous_model else 0.4)
            parts.append(gap)
            pos += len(gap)
        starts.append(round(pos / SR, 2))
        parts.append(x)
        pos += len(x)
        previous_model = line["model"]
    parts.append(silence(0.8))
    out = np.concatenate(parts)
    if kind == "omroep":
        out = loudspeaker(out)
    peak = float(np.max(np.abs(out))) or 1.0
    return out * min(1.0, 0.95 / peak), starts


def write_wav(path: Path, x: np.ndarray) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


# ---------- main ----------


def record_clips(voices: Voices, args) -> None:
    lines = json.loads((ROOT / ".tts" / "texts.json").read_text())
    todo_lines = lines[: args.only] if args.only else lines
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    todo = [l for l in todo_lines if args.force or not (out / f"{l['key']}.m4a").exists()]
    print(f"{len(todo)} of {len(todo_lines)} lines to record", flush=True)
    started = time.time()
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "clip.wav"
        for i, line in enumerate(todo, 1):
            raw.write_bytes(voices.synth(line["model"], line["text"], line["speaker"]))
            encode(raw, out / f"{line['key']}.m4a")
            if i % 100 == 0 or i == len(todo):
                eta = (time.time() - started) / i * (len(todo) - i)
                print(f"[{i}/{len(todo)}] ~{eta:.0f} s left", flush=True)

    if not args.only:
        wanted = {l["key"] for l in lines}
        stale = [f for f in out.glob("*.m4a") if f.stem not in wanted]
        for f in stale:
            f.unlink()
        if stale:
            print(f"removed {len(stale)} clips that are no longer used")
        keys = sorted(l["key"] for l in lines if (out / f"{l['key']}.m4a").exists())
        (out / "manifest.json").write_text(json.dumps({"keys": keys}))
        print(f"manifest: {len(keys)} clips")


def record_fragments(voices: Voices, args) -> None:
    source = ROOT / ".tts" / "fragments.json"
    fragments = json.loads(source.read_text()) if source.exists() else []
    todo_fragments = fragments[: args.only] if args.only else fragments
    out = Path(args.fragments_out)
    out.mkdir(parents=True, exist_ok=True)
    manifest_path = out / "manifest.json"
    timings = json.loads(manifest_path.read_text()).get("fragments", {}) if manifest_path.exists() else {}

    todo = [f for f in todo_fragments if args.force or f["key"] not in timings or not (out / f"{f['key']}.m4a").exists()]
    print(f"{len(todo)} of {len(todo_fragments)} fragments to record", flush=True)
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "fragment.wav"
        for i, fragment in enumerate(todo, 1):
            samples, starts = render_fragment(voices, fragment)
            write_wav(raw, samples)
            encode(raw, out / f"{fragment['key']}.m4a")
            timings[fragment["key"]] = {"duration": round(len(samples) / SR, 2), "starts": starts}
            if i % 10 == 0 or i == len(todo):
                print(f"[{i}/{len(todo)}] fragments", flush=True)

    if not args.only:
        wanted = {f["key"] for f in fragments}
        stale = [f for f in out.glob("*.m4a") if f.stem not in wanted]
        for f in stale:
            f.unlink()
        if stale:
            print(f"removed {len(stale)} fragments that are no longer used")
        timings = {k: v for k, v in sorted(timings.items()) if k in wanted and (out / f"{k}.m4a").exists()}
    manifest_path.write_text(json.dumps({"fragments": timings}))
    print(f"manifest: {len(timings)} fragments")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--pace", type=float, default=1.1, help="above 1 = slower; learners like it a little slow")
    p.add_argument("--only", type=int, help="record only the first N lines and fragments (to try something out)")
    p.add_argument("--out", default=str(ROOT / "public" / "audio" / "voice"))
    p.add_argument("--fragments-out", default=str(ROOT / "public" / "audio" / "fragments"))
    p.add_argument("--force", action="store_true", help="record again even if the file exists")
    args = p.parse_args()

    voices = Voices(args.pace)
    record_clips(voices, args)
    record_fragments(voices, args)


if __name__ == "__main__":
    sys.exit(main())
