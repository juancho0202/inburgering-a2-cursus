# Lesson voices

The voices that read the lessons aloud are recorded ahead of time with
[Piper](https://github.com/OHF-Voice/piper1-gpl), an open-source text-to-speech engine that runs on this computer.
The app ships only the audio files (`public/audio/voice/*.m4a` + `manifest.json`); lines without a clip fall back to
the device's own voice.

Lessons take turns between three voices by their number in the module (lesson 1 ronnie, 2 alex, 3 mls speaker 7,
4 ronnie, …). The list is `LESSON_VOICES` in `src/lib/announce.ts`; change it there and run `npm run voice`.
The mls voice is CC BY 4.0 and is credited on the About page; ronnie and alex are CC0.

## Set up (once)

```sh
python3 -m venv .tts/piper-venv
.tts/piper-venv/bin/pip install piper-tts==1.8.0
mkdir -p .tts/voices   # then download each voice in LESSON_VOICES: <model>.onnx + <model>.onnx.json
```

Voices come from [rhasspy/piper-voices](https://huggingface.co/rhasspy/piper-voices) (`nl/nl_NL/...`); check each file's
md5 against `voices.json` in that repository. Everything lives in `.tts/` (git-ignored); delete the folder to remove it.

## Record

```sh
npm run voice                     # new or changed lines only (and removes clips no longer used)
npm run voice -- --force          # everything again, e.g. after changing --pace
npm run voice -- --pace 1.2       # slower speech
```

`npm run voice` lists every spoken line (`scripts/tts/export-texts.ts`, using the same text as the app) and then
runs Piper inside macOS's sandbox with **network access denied**. Run it after changing course content.
