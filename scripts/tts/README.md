# Lesson voices and listening fragments

The voices that read the lessons aloud, and the people in the listening fragments (Luisteren), are recorded ahead of time with
[Piper](https://github.com/OHF-Voice/piper1-gpl), an open-source text-to-speech engine that runs on this computer.
The app ships only the audio files (`public/audio/voice/*.m4a` and `public/audio/fragments/*.m4a`, each folder with a `manifest.json`);
lines or fragments without a recording fall back to the device's own voice.

Lessons take turns between three voices by their number in the module (lesson 1 ronnie, 2 alex, 3 nathalie,
4 ronnie, …). The list is `LESSON_VOICES` in `src/lib/announce.ts`; change it there and run `npm run voice`.
Adding, removing or moving a lesson changes the voice (and the "Les N." line) of every lesson after it, so those
need recording again too.
All three are CC0. nathalie is Flemish (nl_BE) and the only female Dutch voice in Piper. Avoid the multi-speaker
nl_NL-mls voice: it reads many lines as gibberish. The voice list itself is `VOICES` in `shared/content/voices.ts`.

## Set up (once)

```sh
python3 -m venv .tts/piper-venv
.tts/piper-venv/bin/pip install piper-tts==1.8.0 onnx==1.23.2
mkdir -p .tts/voices   # then download each voice in LESSON_VOICES: <model>.onnx + <model>.onnx.json
```

Voices come from [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) (`nl/nl_NL/...`, `nl/nl_BE/...`); check each file's
md5 against `voices.json` in that repository. Everything lives in `.tts/` (git-ignored); delete the folder to remove it.

For the pronunciation check (below), also the listener and the dictionary. Without them `npm run voice` still
records, but says that it did not check the sound or compare with the dictionary.

```sh
# the listener: a phoneme recogniser, exported once to ONNX (needs PyTorch only for this; ~1.2 GB in .tts/listener)
python3 -m venv .tts/export-venv
.tts/export-venv/bin/pip install torch==2.15.0 transformers==5.23.0 onnx==1.23.2
.tts/export-venv/bin/python -I scripts/tts/export_listener.py
rm -rf .tts/export-venv

# the dictionary: WikiPron's Dutch list at a fixed commit (the URL and SHA256 are in pronunciation/dictionary.py)
mkdir -p .tts/dictionary
curl -L -o .tts/dictionary/nld_latn_broad.tsv \
  https://raw.githubusercontent.com/CUNY-CL/wikipron/d282e848a211ea31cfd730f0ced8bc8cdab9e83d/data/scrape/tsv/nld_latn_broad.tsv
shasum -a 256 .tts/dictionary/nld_latn_broad.tsv   # 1cdb0c53a8f8fec58900e0400e2c563d5b98915e0bc3b9d090fa7d775ef216a1
```

## Record

```sh
npm run voice                     # new or changed lines only (and removes clips no longer used)
npm run voice -- --force          # everything again, e.g. after changing --pace
npm run voice -- --pace 1.2       # slower speech
npm run voice -- --check          # also listen to clips recorded before the check (slow once, then cached)
npm run voice -- --fix            # … and record again the ones with a sound problem
npm run voice:test                # the tests of the check itself
```

`npm run voice` lists every spoken line (`scripts/tts/export-texts.ts`, using the same text as the app) and then
runs Piper inside macOS's sandbox with **network access denied**. Run it after changing course content:
`npm test` fails while a line or fragment has no recording (`tests/unit/voice-recordings.test.ts`), because a device
without a Dutch voice of its own says nothing at all. It also fails when a line has a sign the voice would read by
its name, or a word part (`-tje`, `ge-`) without a pronunciation (`tests/unit/voice-text.test.ts`).

## Checking the pronunciation

`npm run voice` checks every line it records and exits with 1 while there is an error. The findings are in
`.tts/check/report.html` (open it from the repository: each line with a finding, the word marked, a button that plays
from that moment) and `.tts/check/report.json`.

A line can come out wrong in two ways, and each has its own checks:

**The plan is wrong.** Piper does not read text: espeak-ng turns it into phonemes first, and the voice says those.
espeak's Dutch rules get loanwords, stress and some vowels wrong (it said "wannir" for *wanneer*, "in-bur-GEER-en",
"ap" for *app*, "bee-ee" for *be-*). This is the same on every take, so it is found in the text, before any sound:

| check | finds | fix |
| --- | --- | --- |
| `spelled` | a word espeak spells letter by letter | add it to `PRONUNCIATIONS` |
| `foreign` | a word espeak reads in another language (English) | add it to `PRONUNCIATIONS` |
| `dictionary` | espeak's pronunciation is not the dictionary's (WikiPron, compared by sound classes, so ʋ/w or a final d/t do not count) | add it to `PRONUNCIATIONS`, or to `ESPEAK_IS_RIGHT` after listening |
| `short-eer` | a stressed *eer* said short (an espeak rule bug, also in words the dictionary lacks: *studeert*) | add it to `PRONUNCIATIONS` with ɪː |
| `contains` (warning) | a compound with a word that is in `PRONUNCIATIONS` (*verzekeringspas*) | listen; add it if it is wrong too |
| `unknown-phoneme` | a phoneme the voice has no sound for (Piper skips it silently) | fix the pronunciation |

`PRONUNCIATIONS` is in `shared/content/pronunciations.ts`: a word, or a word part with its hyphen, and its phonemes the
way espeak writes Dutch (the voices know no others; `DUTCH_PHONEMES` lists them and the tests check it). The app gives
Piper those phonemes in `[[ ]]` (`voiceInput` in `src/lib/announce.ts`), and the clip name includes them, so every line
with that word is recorded again on the next `npm run voice`. Signs (`→`, `=`, `/`, `·`, brackets, euro amounts,
ordinals) are turned into words for every voice, the device's too, by `speakable`.

**The sound is wrong.** The voice draws random noise, and now and then it mumbles a word, swallows the end of a line or
holds a sound. A *listener* hears every take: a phoneme recogniser (wav2vec 2.0 XLSR-53 fine-tuned on Common Voice to
write espeak phonemes, Apache-2.0; see `export_listener.py`) that does not know the text. The planned sounds are
force-aligned to what it heard, each within 0.1 s of the moment Piper's own timing gives for it, and each
gets the probability that the listener heard that sound there, or one it cannot tell apart from it (`SOUNDS` in
`pronunciation/listener.py`). That is the Goodness of Pronunciation score of pronunciation training. Sounds fluent Dutch
drops or weakens never count: a schwa, the *h* of *het* or after a consonant, the *n* of *-en*, an *r* after a long
vowel (*uur*), a stop between consonants (*ambtenaar*).

| check | finds |
| --- | --- |
| `not-heard` | a word with a vowel the listener did not hear, two of its consonants, or that it hardly heard at all |
| `extra` | clear sounds in a word that were not planned (a mumble, a stray syllable) |
| `too-short` | a take too short for its sounds |
| `drawn-out` (warning) | a sound held unnaturally long (from Piper's timing) |

A take with a sound error is said again with the next seed, up to `--takes` (4) times; takes 3 and 4 use less noise. The
best one is kept. To make that possible, `pronunciation/seeded.py` changes the voice model in memory (the files stay as
downloaded): Piper's two random nodes become inputs filled from a seed, and the phoneme lengths become an output. The
same phonemes, voice, pace and seed give the same audio on every run, so the take that was checked is the take that
ships.

When a word fails in every take, listen to it in the report. If it sounds right, it is the listener's blind spot: put
the word in `HEARD_RIGHT` for that voice (`shared/content/pronunciations.ts`). If it sounds wrong, change the text or
the pronunciation.

The results are kept in `.tts/check/checked.json`, with the take each clip was recorded with. Bump `CHECK_VERSION` in
`generate.py` when a check changes: `--check` then says each clip's take again and checks it anew (exactly the same
audio, with Piper's timing). A clip without a known take (recorded before the check, or its phonemes changed since) is
decoded and checked by the listener alone, which aligns the sounds to the audio itself and finds less; `--fix` records
the ones with an error again.

### Calibration

The listener hears Dutch with an accent, and a word can sound fine while one of its sounds scores low, so the
thresholds (`checks.py`) were set on this course's own lines with known faults put in, and checked on other lines than
the ones they were set on. `scripts/tts/calibrate.py` repeats the measurement; run it after changing a threshold, a voice
or the listener. Its results for the thresholds in this version, on two samples of 100 lines (`--seed 1` and `--seed 2`):

| take | seed 1 | seed 2 |
| --- | --- | --- |
| clean: an error found anyway (a false alarm; it costs a retake) | 2 % | 2 % |
| one word made silent: found in that word | 74 % | 65 % |
| one word swapped for a word of another line: found in that word | 68 % | 72 % |
| cut off in the last word: found | 96 % | 98 % |
| said with far too much noise (mumbling, dragging): an error found | 47 % | 40 % |

A short word is the hardest: the listener guesses it from the words around it. In the recording of the whole course
(1815 lines, fragment lines included), 98 % passed on the first take; one word fails on every take (see `HEARD_RIGHT`).

Without Piper's timing (an old clip, decoded) a cut-off end is found far less often (30–44 %), the rest about 5 points
less often.
The listener does not judge the plan: if espeak's phonemes are wrong, the voice says them well and the listener agrees.
That is what the plan checks are for. Nor does it judge prosody (melody, rhythm).

## Listening fragments

A fragment (`"type": "listening"` exercise, or a `"kind": "fragment"` lesson block) is recorded as **one file**:
`generate.py` says each line with its speaker's voice, trims Piper's silence, makes every voice equally loud and
puts natural pauses between lines (a little longer when someone else speaks). The kind of fragment adds the sound
around it, all made with numpy, no sound files:

| kind | sound |
| --- | --- |
| `telefoon` | the Dutch ringing tone (425 Hz) twice; speakers with `"phone": true` sound like a telephone |
| `voicemail` | a beep; everyone sounds like a telephone |
| `omroep` | a three-note chime, a loudspeaker sound and a small hall |
| `radio` | a short jingle |
| `gesprek`, `uitleg` | nothing |

`public/audio/fragments/manifest.json` gives, per fragment, its length and where each line starts: the app highlights
the line being said and jumps to a line ("Zin terug", tapping a line, "Luister naar het antwoord").
The file name (`fragmentKey` in `src/lib/fragments.ts`) changes when what you hear changes (a line, a voice, the kind),
not when only the situation or a speaker's name changes.

Rules the build checks: each speaker has their own voice (with only one female voice, a fragment has at most one woman),
every line's speaker exists, and every question has `answerLine`, the line where its answer is said.
