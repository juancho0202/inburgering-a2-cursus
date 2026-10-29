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
.tts/piper-venv/bin/pip install piper-tts==1.8.0
mkdir -p .tts/voices   # then download each voice in LESSON_VOICES: <model>.onnx + <model>.onnx.json
```

Voices come from [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) (`nl/nl_NL/...`, `nl/nl_BE/...`); check each file's
md5 against `voices.json` in that repository. Everything lives in `.tts/` (git-ignored); delete the folder to remove it.

## Record

```sh
npm run voice                     # new or changed lines only (and removes clips no longer used)
npm run voice -- --force          # everything again, e.g. after changing --pace
npm run voice -- --pace 1.2       # slower speech
```

`npm run voice` lists every spoken line (`scripts/tts/export-texts.ts`, using the same text as the app) and then
runs Piper inside macOS's sandbox with **network access denied**. Run it after changing course content:
`npm test` fails while a line or fragment has no recording (`tests/unit/voice-recordings.test.ts`), because a device
without a Dutch voice of its own says nothing at all.

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
