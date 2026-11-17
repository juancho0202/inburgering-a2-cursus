"""
Checking the pronunciation of the recorded voice (scripts/tts/README.md, "Checking the pronunciation").

  phonemes    what Piper is asked to say, per sentence and per word (espeak, plus [[phonemes]] from PRONUNCIATIONS)
  seeded      a Piper voice that says the same thing for the same seed and tells how long each phoneme lasts
  listener    a phoneme recogniser that hears which sounds a clip has, and scores each planned phoneme
  dictionary  a Dutch pronunciation dictionary (WikiPron) to compare espeak with
  checks      the checks: on the plan (before any sound) and on the sound (a take of a line)
  report      the findings as JSON and as a page to listen to them
"""
