"""
Records the lesson voices and the listening fragments with Piper (open source, runs offline; see scripts/tts/README.md),
and checks the pronunciation of every line it records ("Checking the pronunciation" in the README).

Reads .tts/texts.json (made by scripts/tts/export-texts.ts: each line with the voice of its lesson and what Piper is
given) and writes one AAC clip per line to public/audio/voice/<key>.m4a plus public/audio/voice/manifest.json.
Reads .tts/fragments.json (each listening fragment: its kind and lines, each with a voice) and writes one recording per
fragment to public/audio/fragments/<key>.m4a plus public/audio/fragments/manifest.json, which says where each line
starts (the app highlights the line being said and jumps to a line).
Files that exist are kept, so only new or changed lines and fragments are recorded on a rerun; unused ones are removed.
Each line is said with a fixed seed (the same audio on every run) and checked; a take with a sound problem is said
again with the next seed, up to --takes times, and the best take is kept. The findings go to .tts/check/report.html.
Exits with 1 when a finding is an error. Use `npm run voice`, which runs this without network access.

  .tts/piper-venv/bin/python -I scripts/tts/generate.py [--only 5] [--force] [--pace 1.1] [--takes 4] [--check] [--fix]
"""

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
import time
import wave
from dataclasses import dataclass
from pathlib import Path

import numpy as np

# -I leaves this script's folder off sys.path; the checks live next to it
sys.path.insert(0, str(Path(__file__).resolve().parent))
from pronunciation.checks import Finding, Lists, PlanChecker, check_recording, check_take, penalty  # noqa: E402
from pronunciation.dictionary import Dictionary  # noqa: E402
from pronunciation.listener import Listener  # noqa: E402
from pronunciation.phonemes import Planner, Sentence  # noqa: E402
from pronunciation.report import Line, Report  # noqa: E402
from pronunciation.seeded import Scales, SeededVoice, seed_for  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
TTS = ROOT / ".tts"
VOICES = TTS / "voices"
CHECKED = TTS / "check" / "checked.json"
SR = 22050  # every Piper "medium" voice
# Bump when a check or a threshold changes: results cached with another version are made again (--check).
CHECK_VERSION = 3


def encode(wav: Path, out: Path) -> None:
    # macOS's own encoder: mono AAC, small and playable in every browser.
    subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "32000", "-c", "1", str(wav), str(out)], check=True)


@dataclass
class Recorded:
    audio: np.ndarray
    findings: list[Finding]
    take: int
    plan: str
    """plan_id of what was said (see Checked.take)."""


def plan_id(sentences: list[Sentence]) -> str:
    """Names the phonemes a take was said from (with their pauses and pace): the same take of the same plan is the same audio."""
    said = ["".join(s.phonemes) + (f" {sorted(s.pauses.items())} {sorted(s.slower.items())}" if s.pauses or s.slower else "") for s in sentences]
    return hashlib.sha256("\n".join(said).encode()).hexdigest()[:16]


class Voices:
    """The Piper voices, each with its planner and checks, and the listener and dictionary they share."""

    def __init__(self, pace: float, takes: int, listener: Listener | None, lists: Lists, dictionary: Dictionary | None):
        self.pace = pace
        self.takes = takes
        self.listener = listener
        self.lists = lists
        self.dictionary = dictionary
        self.models: dict[str, SeededVoice] = {}
        self.checkers: dict[str, PlanChecker] = {}

    def voice(self, model_name: str) -> SeededVoice:
        if model_name not in self.models:
            v = self.models[model_name] = SeededVoice(VOICES / f"{model_name}.onnx")
            assert v.sample_rate == SR, f"{model_name} is not {SR} Hz"
        return self.models[model_name]

    def plan(self, model_name: str, text: str, given: str) -> tuple[list[Sentence], list[Finding]]:
        """What the voice will say, and the problems with that before a sound is made."""
        v = self.voice(model_name)
        espeak_voice = v.planner.voice
        if espeak_voice not in self.checkers:
            self.checkers[espeak_voice] = PlanChecker(Planner(espeak_voice), self.lists, self.dictionary)
        sentences = v.planner.plan(given, text)
        return sentences, self.checkers[espeak_voice].check(sentences, v.missing_phonemes(sentences))

    def record(self, key: str, model_name: str, text: str, given: str, speaker: int | None = None) -> Recorded:
        """
        One line, checked. Takes 1 and 2 use Piper's own noise, later ones less (steadier, a little flatter): the
        first take without a sound error is kept, else the one with the fewest.
        """
        sentences, on_plan = self.plan(model_name, text, given)
        if not sentences:
            return Recorded(np.zeros(int(SR * 0.1), dtype=np.float32), on_plan, 0, plan_id(sentences))
        best: tuple[int, Recorded] | None = None
        for k in range(self.takes):
            take = self.say_take(key, model_name, sentences, k, speaker)
            heard = self.lists.without_heard_right(model_name, check_take(take, self.listener, self.pace))
            if best is None or penalty(heard) < best[0]:
                best = (penalty(heard), Recorded(take.audio, on_plan + heard, k, plan_id(sentences)))
            if not any(f.severity == "error" for f in heard):
                break
        assert best
        return best[1]

    def say_take(self, key: str, model_name: str, sentences: list[Sentence], k: int, speaker: int | None = None):
        """Take k of a line: the same audio every time."""
        scales = Scales(self.pace) if k < 2 else Scales(self.pace, noise=0.5, noise_w=0.6)
        return self.voice(model_name).say(sentences, seed_for(key, k), scales, speaker)


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


def render_fragment(voices: Voices, fragment: dict) -> tuple[np.ndarray, list[float], list[Recorded]]:
    """The whole fragment as samples, the time (s) each line starts, and each line as recorded (with its findings)."""
    kind = fragment["kind"]
    parts: list[np.ndarray] = [LEAD_IN[kind]() if kind in LEAD_IN else silence(0.4)]
    starts: list[float] = []
    lines: list[Recorded] = []
    pos = len(parts[0])
    previous_model = None
    for i, line in enumerate(fragment["lines"]):
        recorded = voices.record(f"{fragment['key']}#{i}", line["model"], line["text"], line.get("input", line["text"]))
        lines.append(recorded)
        x = level(trim(recorded.audio))
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
    return out * min(1.0, 0.95 / peak), starts, lines


def write_wav(path: Path, x: np.ndarray) -> None:
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())


# ---------- checking what is already recorded ----------


class Checked:
    """
    The findings for each recording, kept in .tts/check/checked.json so a rerun reports them without listening again:
    {key: {"version", "findings", and "take", "pace", "plan" when recorded with checks}}. A fragment line is "<key>#<n>".
    """

    def __init__(self, path: Path):
        self.path = path
        self.data: dict[str, dict] = json.loads(path.read_text()) if path.exists() else {}

    def get(self, key: str) -> list[Finding] | None:
        entry = self.data.get(key)
        if not entry or entry.get("version") != CHECK_VERSION:
            return None
        return [Finding(**f) for f in entry["findings"]]

    def take(self, key: str, pace: float, plan: str) -> int | None:
        """
        The take a clip was recorded with, if saying that take again gives the same audio: it was recorded with checks,
        at this pace, from the same phonemes (a change in espeak, the planner or the voice changes them).
        """
        entry = self.data.get(key, {})
        return entry.get("take") if (entry.get("pace"), entry.get("plan")) == (pace, plan) else None

    def recorded_with_checks(self, key: str) -> bool:
        return self.data.get(key, {}).get("take") is not None

    def put(self, key: str, findings: list[Finding], take: int | None = None, pace: float | None = None, plan: str | None = None) -> None:
        # only the sound findings: the plan's are made again on every run (they follow the pronunciation lists)
        entry = {"version": CHECK_VERSION, "take": take, "findings": [f.to_json() for f in findings if not f.on_plan]}
        self.data[key] = entry | ({"pace": pace, "plan": plan} if take is not None else {})

    def keep_only(self, keys: set[str]) -> None:
        self.data = {k: v for k, v in self.data.items() if k.split("#")[0] in keys}

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps(self.data, ensure_ascii=False))


def decode(path: Path, rate: int = 16000) -> np.ndarray:
    """A recording as mono samples (macOS's own decoder)."""
    with tempfile.TemporaryDirectory() as tmp:
        wav = Path(tmp) / "decoded.wav"
        subprocess.run(["afconvert", "-f", "WAVE", "-d", f"LEI16@{rate}", "-c", "1", str(path), str(wav)], check=True)
        with wave.open(str(wav)) as r:
            return np.frombuffer(r.readframes(r.getnframes()), dtype=np.int16).astype(np.float32) / 32768


def listen_again(voices: Voices, checked: Checked, key: str, model: str, text: str, given: str, recording) -> list[Finding]:
    """
    The sound findings of a recording that has none (yet, or of this CHECK_VERSION). One recorded with checks is said
    again with the same take (the same audio) and checked with Piper's timing; an older one is decoded
    (`recording()`) and checked by the listener alone.
    """
    found = checked.get(key)
    if found is None:
        assert voices.listener
        sentences, _ = voices.plan(model, text, given)
        take = checked.take(key, voices.pace, plan_id(sentences))
        if not sentences:
            found = []
        elif take is not None:
            found = check_take(voices.say_take(key, model, sentences, take), voices.listener, voices.pace)
        else:
            found = check_recording(voices.listener, recording(), 16000, sentences)
        found = voices.lists.without_heard_right(model, found)
        checked.put(key, found, take, voices.pace, plan_id(sentences))
    return found


# ---------- main ----------


def record_clips(voices: Voices, checked: Checked, report: Report, args) -> None:
    lines = json.loads((TTS / "texts.json").read_text())
    todo_lines = lines[: args.only] if args.only else lines
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    def failed(key: str) -> bool:
        """An old clip the listener found an error in. A checked recording is not redone: its takes would be the same."""
        return not checked.recorded_with_checks(key) and any(f.severity == "error" for f in checked.get(key) or [])

    # --fix: listen to the old clips first, then record the ones with a sound error again
    if args.check and voices.listener:
        old = [l for l in todo_lines if (out / f"{l['key']}.m4a").exists() and checked.get(l["key"]) is None]
        if old:
            print(f"listening to {len(old)} clips not checked yet", flush=True)
        for i, line in enumerate(old, 1):
            path = out / f"{line['key']}.m4a"
            listen_again(voices, checked, line["key"], line["model"], line["text"], line["input"], lambda: decode(path))
            if i % 100 == 0:
                checked.save()
                print(f"[{i}/{len(old)}] listened", flush=True)
        checked.save()

    todo = [l for l in todo_lines if args.force or not (out / f"{l['key']}.m4a").exists() or (args.fix and failed(l["key"]))]
    print(f"{len(todo)} of {len(todo_lines)} lines to record", flush=True)
    started = time.time()
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "clip.wav"
        for i, line in enumerate(todo, 1):
            recorded = voices.record(line["key"], line["model"], line["text"], line["input"], line["speaker"])
            write_wav(raw, recorded.audio)
            encode(raw, out / f"{line['key']}.m4a")
            checked.put(line["key"], recorded.findings, recorded.take, voices.pace, recorded.plan)
            if i % 100 == 0 or i == len(todo):
                checked.save()
                eta = (time.time() - started) / i * (len(todo) - i)
                print(f"[{i}/{len(todo)}] ~{eta:.0f} s left", flush=True)

    # the report: every line's plan findings, and the sound findings of each clip that has been listened to
    for line in todo_lines:
        _, on_plan = voices.plan(line["model"], line["text"], line["input"])
        entry = checked.data.get(line["key"], {})
        heard = voices.lists.without_heard_right(line["model"], checked.get(line["key"]) or [])
        report.add(Line(line["key"], line["text"], line["model"], f"public/audio/voice/{line['key']}.m4a", 0.0, on_plan + heard, entry.get("take")))

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


def record_fragments(voices: Voices, checked: Checked, report: Report, args) -> None:
    source = TTS / "fragments.json"
    fragments = json.loads(source.read_text()) if source.exists() else []
    todo_fragments = fragments[: args.only] if args.only else fragments
    out = Path(args.fragments_out)
    out.mkdir(parents=True, exist_ok=True)
    manifest_path = out / "manifest.json"
    timings = json.loads(manifest_path.read_text()).get("fragments", {}) if manifest_path.exists() else {}

    def recorded(f: dict) -> bool:
        return f["key"] in timings and (out / f"{f['key']}.m4a").exists()

    def failed(f: dict) -> bool:
        keys = [f"{f['key']}#{i}" for i in range(len(f["lines"]))]
        return any(not checked.recorded_with_checks(k) and any(e.severity == "error" for e in checked.get(k) or []) for k in keys)

    if args.check and voices.listener:
        for f in [f for f in todo_fragments if recorded(f)]:
            decoded: list[np.ndarray] = []

            def piece(i: int, f: dict = f, decoded: list = decoded) -> np.ndarray:
                if not decoded:
                    decoded.append(decode(out / f"{f['key']}.m4a"))
                starts = timings[f["key"]]["starts"] + [timings[f["key"]]["duration"]]
                return decoded[0][int(starts[i] * 16000) : int(starts[i + 1] * 16000)]

            for i, line in enumerate(f["lines"]):
                key = f"{f['key']}#{i}"
                # Through a telephone or a loudspeaker a line is too changed for the listener; a take (said again
                # before the effects) can still be checked, an old recording cannot.
                if checked.get(key) is not None:
                    continue
                if line["phone"] or f["kind"] == "omroep":
                    sentences, _ = voices.plan(line["model"], line["text"], line.get("input", line["text"]))
                    if checked.take(key, voices.pace, plan_id(sentences)) is None:
                        continue
                listen_again(voices, checked, key, line["model"], line["text"], line.get("input", line["text"]), lambda i=i: piece(i))
        checked.save()

    todo = [f for f in todo_fragments if args.force or not recorded(f) or (args.fix and failed(f))]
    print(f"{len(todo)} of {len(todo_fragments)} fragments to record", flush=True)
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "fragment.wav"
        for i, fragment in enumerate(todo, 1):
            samples, starts, lines = render_fragment(voices, fragment)
            write_wav(raw, samples)
            encode(raw, out / f"{fragment['key']}.m4a")
            timings[fragment["key"]] = {"duration": round(len(samples) / SR, 2), "starts": starts}
            for n, line in enumerate(lines):
                checked.put(f"{fragment['key']}#{n}", line.findings, line.take, voices.pace, line.plan)
            if i % 10 == 0 or i == len(todo):
                checked.save()
                print(f"[{i}/{len(todo)}] fragments", flush=True)

    for f in todo_fragments:
        for n, line in enumerate(f["lines"]):
            _, on_plan = voices.plan(line["model"], line["text"], line.get("input", line["text"]))
            start = timings.get(f["key"], {}).get("starts", [0.0] * len(f["lines"]))[n]
            key = f"{f['key']}#{n}"
            heard = voices.lists.without_heard_right(line["model"], checked.get(key) or [])
            report.add(Line(key, line["text"], line["model"], f"public/audio/fragments/{f['key']}.m4a", start, on_plan + heard, checked.data.get(key, {}).get("take")))

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


def load_lists() -> Lists:
    data = json.loads((TTS / "pronunciations.json").read_text())
    heard_right = {model: {w.lower() for w in words} for model, words in data.get("heardRight", {}).items()}
    return Lists(data["pronunciations"], set(data["espeakIsRight"]), set(data["letterNames"]), heard_right)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--pace", type=float, default=1.1, help="above 1 = slower; learners like it a little slow")
    p.add_argument("--only", type=int, help="record only the first N lines and fragments (to try something out)")
    p.add_argument("--out", default=str(ROOT / "public" / "audio" / "voice"))
    p.add_argument("--fragments-out", default=str(ROOT / "public" / "audio" / "fragments"))
    p.add_argument("--force", action="store_true", help="record again even if the file exists")
    p.add_argument("--takes", type=int, default=4, help="how often a line with a sound problem may be said again")
    p.add_argument("--check", action="store_true", help="also listen to clips recorded before the check (slow once, then cached)")
    p.add_argument("--fix", action="store_true", help="record again the clips the listener found a problem in (implies --check)")
    args = p.parse_args()
    args.check = args.check or args.fix

    listener_dir, dictionary_file = TTS / "listener", TTS / "dictionary" / "nld_latn_broad.tsv"
    listener = Listener(listener_dir) if (listener_dir / "model.onnx").exists() else None
    dictionary = Dictionary(dictionary_file) if dictionary_file.exists() else None
    if not listener:
        print("no listener in .tts/listener: the sound is not checked (scripts/tts/README.md, set up)")
    if not dictionary:
        print("no dictionary in .tts/dictionary: espeak is not compared with it (scripts/tts/README.md, set up)")

    voices = Voices(args.pace, max(1, args.takes), listener, load_lists(), dictionary)
    checked = Checked(CHECKED)
    report = Report()
    record_clips(voices, checked, report, args)
    record_fragments(voices, checked, report, args)
    if not args.only:
        keys = {l["key"] for l in json.loads((TTS / "texts.json").read_text())}
        keys |= {f["key"] for f in json.loads((TTS / "fragments.json").read_text())}
        checked.keep_only(keys)
    checked.save()

    page = report.write(TTS / "check", ROOT)
    print(report.summary())
    print(f"report: {page.relative_to(ROOT)}")
    return 1 if report.errors() else 0


if __name__ == "__main__":
    sys.exit(main())
