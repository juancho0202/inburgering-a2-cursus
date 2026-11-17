"""
Makes the "listener" for the voice check (scripts/tts/README.md, "Checking the pronunciation"): a phoneme recogniser
that hears which sounds a clip contains, without knowing which words were meant.

It is wav2vec 2.0 XLSR-53 fine-tuned on Common Voice to write espeak phonemes (Xu, Baevski & Auli 2021,
https://arxiv.org/abs/2109.11680, Apache-2.0), the same phoneme alphabet Piper speaks from. This script downloads one
fixed revision and exports it to ONNX, so the check runs in the Piper venv with onnxruntime alone (no PyTorch, no
network). Run it once, in a separate venv that may be deleted afterwards:

  python3 -m venv .tts/export-venv
  .tts/export-venv/bin/pip install torch==2.15.0 transformers==5.23.0 onnx==1.23.2
  .tts/export-venv/bin/python -I scripts/tts/export_listener.py
  rm -rf .tts/export-venv

Writes .tts/listener/{model.onnx, vocab.json, listener.json}.
"""

import hashlib
import json
import sys
from pathlib import Path

import torch
from transformers import Wav2Vec2ForCTC

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / ".tts" / "listener"
REPO = "facebook/wav2vec2-xlsr-53-espeak-cv-ft"
# A fixed revision: another one could hear differently, and the thresholds in qa.py are set for this one.
REVISION = "2c733782da5604684829819a5eb744c193fe9398"


class Logits(torch.nn.Module):
    """Normalised 16 kHz audio in, log-probabilities per 20 ms frame out (the CTC posteriors the check needs)."""

    def __init__(self, model: Wav2Vec2ForCTC):
        super().__init__()
        self.model = model

    def forward(self, audio: torch.Tensor) -> torch.Tensor:
        return torch.log_softmax(self.model(audio).logits, dim=-1)


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    model = Wav2Vec2ForCTC.from_pretrained(REPO, revision=REVISION).eval()
    # The vocabulary sits next to the weights; its order is the order of the model's outputs.
    from huggingface_hub import hf_hub_download

    vocab = json.loads(Path(hf_hub_download(REPO, "vocab.json", revision=REVISION)).read_text())
    labels = [label for label, _ in sorted(vocab.items(), key=lambda kv: kv[1])]
    assert len(labels) == model.config.vocab_size, "vocab.json does not match the model"

    path = OUT / "model.onnx"
    example = torch.zeros(1, 16000 * 3)
    torch.onnx.export(
        Logits(model),
        (example,),
        str(path),
        input_names=["audio"],
        output_names=["log_probs"],
        dynamic_axes={"audio": {1: "samples"}, "log_probs": {1: "frames"}},
        opset_version=17,
        dynamo=False,
    )
    (OUT / "vocab.json").write_text(json.dumps(labels, ensure_ascii=False))
    digest = hashlib.sha256(path.read_bytes()).hexdigest()
    (OUT / "listener.json").write_text(
        json.dumps({"repo": REPO, "revision": REVISION, "sample_rate": 16000, "sha256": digest}, indent=1)
    )
    print(f"{path} ({path.stat().st_size // 2**20} MB), {len(labels)} phoneme labels")
    return 0


if __name__ == "__main__":
    sys.exit(main())
