"""
A Piper voice that says the same thing every time for the same seed, and tells how long each phoneme lasts.

Piper's VITS models draw random noise inside the ONNX graph (two RandomNormalLike nodes: one for the phoneme
lengths, one for the sound), so every run sounds a little different and a bad take cannot be reproduced. Setting a
seed on those nodes does not help: onnxruntime keeps one random stream per session, so a line would depend on every
line said before it. Instead the model is changed in memory, without touching the file:
  - each RandomNormalLike becomes a Slice of a new input (noise_0, noise_1) that is filled from numpy with a seed;
  - the phoneme lengths (the w_ceil tensor) become an output, with Piper's own patch_voice_with_alignment.
The noise for frame t is the same however large the buffer is, so the result depends only on the phonemes, the
scales and the seed.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import onnx
import onnxruntime
from onnx import TensorProto, helper
from onnxruntime.capi.onnxruntime_pybind11_state import Fail as OnnxFailure
from piper.config import PiperConfig
from piper.patch_voice_with_alignment import add_alignment_output
from piper.phoneme_ids import phonemes_to_ids

from .phonemes import Planner, Sentence

# Wider than any Piper voice's noise (2 channels for the lengths, 192 for the sound in "medium" voices): a Slice
# takes the channels the model needs.
_CHANNELS = 256
_FRAMES_PER_ID = 32  # a first guess of the buffer; grown when a line is slower


class UnsupportedVoice(Exception):
    pass


@dataclass(frozen=True)
class Scales:
    """Piper's synthesis settings: length (above 1 is slower), noise (variation in sound) and noise_w (in length)."""

    length: float
    noise: float = 0.667
    noise_w: float = 0.8


@dataclass
class SpokenSentence:
    plan: Sentence
    start: int
    """Where it starts in the take (samples)."""
    phoneme_samples: np.ndarray
    """Samples per phoneme of plan.phonemes (each with the short pause Piper puts after it)."""
    lead: int
    """Samples before the first phoneme (the start of the sentence's silence)."""

    def span(self, start: int, end: int) -> tuple[int, int]:
        """The samples of phonemes start..end in the take."""
        before = int(self.phoneme_samples[:start].sum())
        inside = int(self.phoneme_samples[start:end].sum())
        first = self.start + self.lead + before
        return first, first + inside


@dataclass
class Take:
    audio: np.ndarray
    """float32 in [-1, 1], at the voice's sample rate; each sentence scaled to full range, as Piper does."""
    sample_rate: int
    sentences: list[SpokenSentence]
    seed: int
    scales: Scales

    def timings(self) -> list[list[tuple[float, float]]]:
        """Per sentence, per phoneme: when the voice says it (start and end, seconds into the take)."""
        out = []
        for s in self.sentences:
            ends = s.start + s.lead + np.cumsum(s.phoneme_samples)
            starts = np.concatenate([[s.start + s.lead], ends[:-1]])
            out.append([(a / self.sample_rate, b / self.sample_rate) for a, b in zip(starts, ends)])
        return out


def seed_for(key: str, take: int) -> int:
    """The seed of take `take` of a line: the same on every computer and every run."""
    return int.from_bytes(hashlib.sha256(f"{key}#{take}".encode()).digest()[:8], "big")


class SeededVoice:
    def __init__(self, model_path: Path, threads: int = 0):
        config = json.loads(Path(f"{model_path}.json").read_text(encoding="utf-8"))
        self.config = PiperConfig.from_dict(config)
        self.sample_rate = self.config.sample_rate
        self.hop = self.config.hop_length
        self.planner = Planner(self.config.espeak_voice)
        model = onnx.load(str(model_path))
        add_alignment_output(model)
        self.noise_inputs = _seed_the_noise(model)
        options = onnxruntime.SessionOptions()
        options.intra_op_num_threads = threads
        # a buffer that was too small is retried (see _run); onnxruntime would log it as an error first
        options.log_severity_level = 4
        self.session = onnxruntime.InferenceSession(model.SerializeToString(), options, providers=["CPUExecutionProvider"])
        self.speaker_input = "sid" in {i.name for i in self.session.get_inputs()}

    def missing_phonemes(self, sentences: list[Sentence]) -> set[str]:
        """Phonemes the voice has no id for: Piper would skip them without a word."""
        return {p for s in sentences for p in s.phonemes if p not in self.config.phoneme_id_map}

    def say(self, sentences: list[Sentence], seed: int, scales: Scales, speaker: int | None = None) -> Take:
        parts: list[np.ndarray] = []
        spoken: list[SpokenSentence] = []
        position = 0
        for i, sentence in enumerate(sentences):
            ids = phonemes_to_ids(sentence.phonemes, self.config.phoneme_id_map)
            if len(ids) != 2 * len(sentence.phonemes) + 3:
                raise ValueError(f"phonemes without an id: {self.missing_phonemes([sentence])}")
            audio, frames = self._run(ids, np.random.SeedSequence([seed, i]), scales, speaker)
            samples = frames.astype(np.int64) * self.hop
            # Piper's layout: BOS, PAD, then each phoneme followed by PAD, then EOS
            per_phoneme = samples[2:-1:2] + samples[3:-1:2]
            peak = float(np.max(np.abs(audio))) or 1.0
            parts.append((audio / peak).astype(np.float32))
            spoken.append(SpokenSentence(sentence, position, per_phoneme, int(samples[0] + samples[1])))
            position += len(audio)
        audio = np.concatenate(parts) if parts else np.zeros(0, dtype=np.float32)
        return Take(audio, self.sample_rate, spoken, seed, scales)

    def _run(self, ids: list[int], seeds: np.random.SeedSequence, scales: Scales, speaker: int | None):
        # generous, so a second run for a slow line is rare (each phoneme id rarely gets more than ~30 frames)
        frames_guess = max(64, int(len(ids) * _FRAMES_PER_ID * max(1.0, scales.length)))
        # spawn() gives new children on every call: make them once, so a second run draws the same numbers
        children = seeds.spawn(len(self.noise_inputs))
        while True:
            streams = [np.random.default_rng(child) for child in children]
            feed = {
                "input": np.array([ids], dtype=np.int64),
                "input_lengths": np.array([len(ids)], dtype=np.int64),
                "scales": np.array([scales.noise, scales.length, scales.noise_w], dtype=np.float32),
            }
            if self.speaker_input:
                feed["sid"] = np.array([speaker or 0], dtype=np.int64)
            for name, rng in zip(self.noise_inputs, streams):
                # drawn frame by frame, so frame t gets the same numbers whatever the buffer's length
                feed[name] = np.ascontiguousarray(rng.standard_normal((frames_guess, _CHANNELS), dtype=np.float32).T[None])
            try:
                audio, frames = self.session.run(None, feed)[:2]
            except OnnxFailure as error:
                if "broadcast" not in str(error) or frames_guess > 1 << 16:
                    raise
                # a slow line: more frames than the buffer had. Same seeds, so the same numbers, only more.
                frames_guess *= 4
                continue
            return audio.squeeze().astype(np.float32), frames.squeeze()


def _seed_the_noise(model: onnx.ModelProto) -> list[str]:
    """Replace each RandomNormalLike(x) with Slice(noise_k, 0, shape(x)); returns the new inputs' names."""
    nodes = [n for n in model.graph.node if n.op_type == "RandomNormalLike"]
    if len(nodes) != 2:
        raise UnsupportedVoice(f"expected the 2 noise nodes of a Piper VITS voice, found {len(nodes)}")
    zeros = "seeded_noise_starts"
    model.graph.initializer.append(helper.make_tensor(zeros, TensorProto.INT64, [3], [0, 0, 0]))
    names = []
    for k, node in enumerate(nodes):
        name = f"noise_{k}"
        model.graph.input.append(helper.make_tensor_value_info(name, TensorProto.FLOAT, [1, _CHANNELS, None]))
        shape = f"{name}_shape"
        at = list(model.graph.node).index(node)
        model.graph.node.remove(node)
        model.graph.node.insert(at, helper.make_node("Slice", [name, zeros, shape], [node.output[0]], name=f"{node.name}_seeded"))
        model.graph.node.insert(at, helper.make_node("Shape", [node.input[0]], [shape], name=f"{node.name}_shape"))
        names.append(name)
    return names

