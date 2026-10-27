"""
Records the lesson voices with Piper (open source, runs offline; see scripts/tts/README.md).

Reads .tts/texts.json (made by scripts/tts/export-texts.ts: each line with the voice of its lesson) and writes one
AAC clip per line to public/audio/voice/<key>.m4a plus public/audio/voice/manifest.json. Clips that exist are kept,
so only new or changed lines are recorded on a rerun; clips no longer used are removed.
Use `npm run voice`, which runs this without network access.

  .tts/piper-venv/bin/python -I scripts/tts/generate.py [--only 5] [--out dir] [--force] [--pace 1.1]
"""

import argparse
import json
import subprocess
import sys
import tempfile
import time
import wave
from pathlib import Path

from piper import PiperVoice, SynthesisConfig

ROOT = Path(__file__).resolve().parents[2]
VOICES = ROOT / ".tts" / "voices"


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--pace", type=float, default=1.1, help="above 1 = slower; learners like it a little slow")
    p.add_argument("--only", type=int, help="record only the first N lines (to try something out)")
    p.add_argument("--out", default=str(ROOT / "public" / "audio" / "voice"))
    p.add_argument("--force", action="store_true", help="record again even if the clip exists")
    args = p.parse_args()

    lines = json.loads((ROOT / ".tts" / "texts.json").read_text())
    todo_lines = lines[: args.only] if args.only else lines
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    todo = [l for l in todo_lines if args.force or not (out / f"{l['key']}.m4a").exists()]
    print(f"{len(todo)} of {len(todo_lines)} lines to record", flush=True)
    models: dict[str, PiperVoice] = {}
    started = time.time()
    with tempfile.TemporaryDirectory() as tmp:
        raw = Path(tmp) / "clip.wav"
        for i, line in enumerate(todo, 1):
            model = models.get(line["model"])
            if model is None:
                model = models[line["model"]] = PiperVoice.load(VOICES / f"{line['model']}.onnx")
            config = SynthesisConfig(speaker_id=line["speaker"], length_scale=args.pace)
            with wave.open(str(raw), "wb") as w:
                model.synthesize_wav(line["text"], w, syn_config=config)
            # macOS's own encoder: mono AAC, small and playable in every browser.
            subprocess.run(["afconvert", "-f", "m4af", "-d", "aac", "-b", "32000", "-c", "1", str(raw), str(out / f"{line['key']}.m4a")], check=True)
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


if __name__ == "__main__":
    sys.exit(main())
