"""
The findings of a run: .tts/check/report.json, and .tts/check/report.html, a page to listen to every line with a
finding (the word is marked, a button plays from the moment of the problem). Open it in a browser from the repository.
"""

from __future__ import annotations

import html
import json
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

from .checks import Finding


@dataclass
class Line:
    key: str
    """The clip (voice) or fragment key; for a fragment line, "<fragment>#<line>"."""
    text: str
    voice: str
    audio: str
    """Path of the recording, relative to the repository."""
    offset: float = 0.0
    """Where the line starts in the recording (a fragment line)."""
    findings: list[Finding] = field(default_factory=list)
    take: int | None = None
    """The take that was kept (0 is the first), when it was recorded in this run."""


class Report:
    def __init__(self) -> None:
        self.lines: list[Line] = []

    def add(self, line: Line) -> None:
        if line.findings:
            self.lines.append(line)

    def findings(self) -> list[tuple[Line, Finding]]:
        return [(line, f) for line in self.lines for f in line.findings]

    def errors(self) -> int:
        return sum(f.severity == "error" for _, f in self.findings())

    def summary(self, limit: int = 25) -> str:
        found = self.findings()
        if not found:
            return "pronunciation check: no findings"
        counts = Counter(f"{f.check} ({f.severity})" for _, f in found)
        out = ["pronunciation check: " + ", ".join(f"{n} {c}" for c, n in counts.most_common())]
        # the plan findings repeat for every line with the word: show each word once
        shown: set[tuple[str, str]] = set()
        for line, f in sorted(found, key=lambda lf: (lf[1].severity != "error", not lf[1].on_plan, lf[1].check, lf[1].word)):
            if f.on_plan and (f.check, f.word.lower()) in shown:
                continue
            shown.add((f.check, f.word.lower()))
            where = f" at {f.at:.2f} s" if f.at is not None else ""
            out.append(f"  {f.severity:7} {f.check:15} {line.key} \"{f.word}\"{where}: {f.message}")
            if len(out) > limit:
                out.append(f"  … see the report for all {len(found)}")
                break
        return "\n".join(out)

    def write(self, folder: Path, root: Path) -> Path:
        folder.mkdir(parents=True, exist_ok=True)
        data = [
            {"key": l.key, "text": l.text, "voice": l.voice, "audio": l.audio, "offset": l.offset, "take": l.take, "findings": [f.to_json() for f in l.findings]}
            for l in self.lines
        ]
        (folder / "report.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
        page = folder / "report.html"
        page.write_text(_page(self.lines, folder, root), encoding="utf-8")
        return page


def _page(lines: list[Line], folder: Path, root: Path) -> str:
    rows = []
    for line in sorted(lines, key=lambda l: (not any(f.severity == "error" for f in l.findings), l.key)):
        words = {f.word for f in line.findings if f.word}
        text = html.escape(line.text)
        for w in sorted(words, key=len, reverse=True):
            text = text.replace(html.escape(w), f"<mark>{html.escape(w)}</mark>", 1)
        src = html.escape(str(Path("..", "..", line.audio)) if folder.resolve().is_relative_to(root.resolve()) else line.audio)
        items = "".join(
            f'<li class="{f.severity}"><b>{html.escape(f.check)}</b> {html.escape(f.word)}: {html.escape(f.message)}'
            + (f' <button data-at="{line.offset + f.at:.2f}">▶ {f.at:.2f} s</button>' if f.at is not None else "")
            + "</li>"
            for f in line.findings
        )
        take = f" · take {line.take + 1}" if line.take else ""
        rows.append(
            f'<section><h2>{html.escape(line.key)} <small>{html.escape(line.voice)}{take}</small></h2><p>{text}</p>'
            f'<audio controls preload="none" src="{src}" data-offset="{line.offset:.2f}"></audio><ul>{items}</ul></section>'
        )
    return f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pronunciation check</title>
<style>
:root {{ color-scheme: light dark; --bg: #fff; --fg: #1d1d1f; --muted: #6e6e73; --err: #c62828; --warn: #a15c00; --mark: #ffe08a; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg: #17181c; --fg: #ececf1; --muted: #9a9aa3; --err: #ff6b6b; --warn: #f0b35a; --mark: #6b5a1d; }} }}
body {{ background: var(--bg); color: var(--fg); font: 16px/1.5 system-ui, sans-serif; margin: 0 auto; max-width: 860px; padding: 16px; }}
section {{ border-top: 1px solid color-mix(in srgb, var(--fg) 15%, transparent); padding: 12px 0; }}
h2 {{ font-size: 15px; margin: 0; }} small {{ color: var(--muted); font-weight: normal; }}
mark {{ background: var(--mark); color: inherit; border-radius: 3px; padding: 0 2px; }}
audio {{ width: 100%; }} li.error b {{ color: var(--err); }} li.warning b {{ color: var(--warn); }}
button {{ font: inherit; font-size: 13px; }}
</style></head><body>
<h1>Pronunciation check</h1>
<p>{len(lines)} lines with findings. Plan findings are the same in every take: fix them in shared/content/pronunciations.ts.</p>
{"".join(rows) or "<p>Nothing to listen to.</p>"}
<script>
for (const audio of document.querySelectorAll("audio")) {{
  const offset = Number(audio.dataset.offset);
  if (offset) audio.addEventListener("loadedmetadata", () => {{ if (audio.currentTime < offset) audio.currentTime = offset; }}, {{ once: true }});
}}
for (const b of document.querySelectorAll("button[data-at]")) {{
  b.addEventListener("click", () => {{
    const audio = b.closest("section").querySelector("audio");
    const go = () => {{ audio.currentTime = Math.max(0, Number(b.dataset.at) - 0.4); audio.play(); }};
    audio.readyState ? go() : (audio.addEventListener("loadedmetadata", go, {{ once: true }}), audio.load());
  }});
}}
</script></body></html>
"""
