"""Shared bits for the tests of the pronunciation check (npm run voice:test)."""

import unittest
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
TTS = ROOT / ".tts"
VOICE = TTS / "voices" / "nl_NL-alex-medium.onnx"
LISTENER = TTS / "listener"

needs_voice = unittest.skipUnless(VOICE.exists(), "needs the Piper voice in .tts/voices (scripts/tts/README.md)")
needs_listener = unittest.skipUnless((LISTENER / "model.onnx").exists() and VOICE.exists(), "needs .tts/listener and a voice")


@lru_cache(maxsize=None)
def voice():
    from pronunciation.seeded import SeededVoice

    return SeededVoice(VOICE)


@lru_cache(maxsize=None)
def listener():
    from pronunciation.listener import Listener

    return Listener(LISTENER)
