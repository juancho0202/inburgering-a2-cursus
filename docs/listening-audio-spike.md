# Spike: audio for a Luisteren (listening) section

Goal: find legal ways to get **A2-level Dutch audio** that this app can **host itself** (static files on Netlify, cached offline by the PWA), and use it for listening exercises.

Not legal advice. Check each source's licence page again before shipping, because terms change.

## TL;DR

- **Scraping NOS/NPO or ordinary YouTube channels and hosting the files is not legal for us.** The NOS terms forbid copying or publishing their audio/video beyond private, non-commercial use without written permission. YouTube's terms forbid downloading except through YouTube's own features.
- **NOS Journaal in Makkelijke Taal** has the right level and topics, but it's NOS content. We can **link** to it or **ask NOS for permission**. We can't download it.
- **Best path: make our own audio.** Write A2 scripts (we already have a Claude integration and a content pipeline). Render them with a TTS engine whose output we may publish, at build time, and commit the audio files. We own the texts, the level is exactly A2, and every clip can be tied to questions and to the existing vocabulary.
- **Real voices, add-on:** Creative Commons sources (Common Voice CC0, Lingua Libre CC BY-SA, CC-BY YouTube videos, Open Beelden) are useful for pronunciation and "real world" clips, but there's little A2-level material. Use them selectively.

## Options compared

| # | Source | Level fit | May we host it? | Effort | Verdict |
|---|---|---|---|---|---|
| 1 | Own scripts + build-time neural TTS | Exactly A2 (we write it) | **Yes** (depends on TTS licence, see below) | Medium | **Main path** |
| 2 | Own scripts + recordings by real people (friends, volunteers, paid voice actor) | Exactly A2 | **Yes**, with a signed release | Medium–high | Best quality for a small "premium" set |
| 3 | Browser `speechSynthesis` (already in the app: `src/composables/useSpeech.ts`) | Exactly A2 | Nothing to host | Very low | Fallback and prototype only: voice quality varies a lot by device, some phones have no Dutch voice |
| 4 | Mozilla Common Voice NL (CC0, ~138 h, 1,800+ speakers) | Single read sentences, mixed level | Yes (CC0) | Medium (filter sentences by A2 vocab) | Good for **dictation** and "which sentence do you hear?" drills. Download terms: don't try to identify speakers |
| 5 | Lingua Libre / Wikimedia Commons (CC BY-SA 4.0) | Single words | Yes, with attribution + share-alike on the audio | Low | Good for **vocabulary pronunciation** (word list → audio) |
| 6 | YouTube videos with the **CC BY** licence (filter: Creative Commons) | Rarely A2; must be curated by hand | Yes, with attribution | High (curation) | Occasional authentic clips. The licence must be visible on the video, and the uploader must actually own it |
| 7 | Open Beelden / Beeld en Geluid (mostly CC BY-SA; Polygoon newsreels) | Historic, too hard for A2 | Yes, per item licence | Medium | Maybe for KNM *geschiedenis* "background" clips, not for listening exercises |
| 8 | Tatoeba sentence audio | Short sentences, often A1–A2 | **Per speaker**. Many Dutch speakers use **CC BY-NC**. | Medium | Only from speakers with CC BY/CC0. Text (CC BY 2.0 FR) is usable as script inspiration |
| 9 | NOS Journaal in Makkelijke Taal (NPO 1, ~10 min, 3 topics) | **Very good** | **No** without written permission | — | **Link out** ("Kijk ook...") or **ask NOS** (see below) |
| 10 | Ordinary YouTube channels / learner podcasts (Zeg het in het Nederlands, Een Beetje Nederlands, ...) | Varies | **No** (all rights reserved) | — | Link or embed only, or ask the creator for a licence |
| 11 | DUO official practice exams (Luisteren) | Exact exam format | **No** (DUO material) | — | Link to inburgeren.nl. Copy the **format**, never the content |
| 12 | YouTube **embed** (IFrame player) of any public video | Varies | Not hosted, so not needed | Low | Legal, but needs the network (breaks offline mode). Also sends data to Google, which conflicts with the README's "no data is sent" promise. Only behind a clear opt-in |

## Why scraping is out

- **NOS/NPO:** the NOS general terms (latest version 1 Oct 2025) say that copying and/or publishing content, other than personal non-commercial use, needs written permission from NOS. NPO has also said that downloading its streams is not allowed. Hosting their clips in our app would be publishing.
- **YouTube:** the terms forbid downloading except through YouTube's own download function. A Creative Commons licence on a video is the exception: the creator grants reuse under CC BY.
- **Dutch citation right (Auteurswet art. 15a)** allows short quotes *inside* our own work, with a source. It doesn't cover a library of full clips used as exercises. **The education exception (art. 16)** covers teaching inside an institution, not a public website. Don't build on these.

## Recommended design: "own scripts → TTS → static audio"

### 1. Content

Mirror the DUO Luisteren A2 format (short everyday situations, multiple choice):

- **Dialogues:** at the doctor, the gemeente, the supermarket, a phone call with school, a colleague, directions (also a known weak spot: *rechtsaf / rechtdoor*).
- **Announcements:** train station, shop, voicemail, radio weather.
- **Short "news" items in easy Dutch** in the style of NOS Makkelijke Taal, written by us, about KNM themes (this ties listening to KNM).
- **Dictation** with single sentences (Common Voice / our TTS).

Add a new module next to `lezen`, `knm`, `schrijven`:

```
data/course/luisteren/
  module.json
  units/<unit>/lesson-xx.json      # script, speakers, questions (same schema style as lezen)
public/audio/luisteren/<id>.opus   # generated, committed (or generated in CI)
```

Each clip in JSON: `id`, `speakers` (voice per role), `script` (lines with speaker + text), `speed` (normal/slow), `questions`, `transcript shown after answering`, `source`/`licence` (needed for CC clips).

`npm run validate` can check that each clip's audio file exists and that the script uses vocabulary from the course (reuse the stats script).

### 2. TTS engine choice

Generate at **build/authoring time**, not in the browser. That way the API key stays out of the app, there's no per-user cost, and audio works offline.

| Engine | Dutch voices | Licence of output | Cost | Notes |
|---|---|---|---|---|
| **Azure AI Speech** neural | nl-NL Fenna, Colette (F), Maarten (M) + nl-BE | Commercial use OK on a **paid** (pay-as-you-go) tier, per Microsoft Q&A. Also read the code of conduct. | Pay per character. Our whole course is small | SSML: per-line voice, pauses, `rate="-10%"` for a slow version. Strong candidate |
| Google Cloud TTS (Neural2/Chirp) | Several nl-NL | Output may be used. Check the current terms | Pay per character, free tier | Similar to Azure |
| ElevenLabs / other AI voice services | Very natural | Usually commercial use only on a paid plan | Subscription | Most natural. Check the plan terms |
| **Piper** (open source, local) | nl_NL (MLS data, CC BY 4.0), nl_BE nathalie/rdh | Repo is MIT, but **check each voice's model card**. The training data can bring CC BY attribution | Free, runs offline in CI | Lower quality, but no account and fully reproducible |
| Browser `speechSynthesis` | Depends on device | — | Free | Keep as fallback (already exists) |

Practical tip: use **2–3 different voices** so learners hear men/women and different speaker roles. For dialogues, render line by line and concatenate with ~400 ms pauses (ffmpeg). Make a **normal** and a **slow** version.

### 3. File size / offline

- Encode as **Opus mono 24 kbps** (`.opus`/`.webm`). That's about 180 KB per minute, so 60 minutes of audio is about 11 MB. AAC `.m4a` at 32 kbps as a fallback for older iOS Safari, if needed.
- Don't precache all audio in the service worker. Cache **per lesson when opened** (runtime cache), and maybe offer a "download this unit for offline" button.

### 4. Exercise types (reuse the existing ones where possible)

1. Listen → multiple choice (exam format).
2. Listen → choose the right picture/route (directions).
3. Dictation: type the sentence you hear (Common Voice CC0 or TTS). Lenient comparison.
4. "Which word do you hear?" minimal pairs (*man/maan*, *vis/vies*, *hut/huid*...) using Lingua Libre words.
5. Transcript after answering, with the existing SpeakButton per sentence.
6. Optional Claude help (already exists): "explain this dialogue", or generate *new* A2 scripts for the author pipeline. Claude writes scripts, a human reviews them, TTS renders them.

## Real-voice sources: how to use them legally

- **Common Voice NL (CC0):** download from Mozilla Data Collective (needs an account, accept terms). Filter `validated.tsv` on sentence length (≤ 10 words) and A2 vocabulary. Keep only clips with good up/down votes. Store the `client_id`-free path only. CC0 needs no attribution, but credit it anyway.
- **Lingua Libre (CC BY-SA 4.0):** query Wikimedia Commons (category *Lingua Libre pronunciation-nld*) through the API for words in our vocab list. Put attribution (speaker username + licence link) on a credits page and in the clip JSON.
- **YouTube CC BY:** search with the Creative Commons filter, review by hand, and check that the uploader is the real owner (re-uploads of TV content with a fake CC tag are common). Keep a record (URL, channel, date, screenshot of the licence). Attribution: title, creator, link, licence, "changes made" (e.g., cut).
- **Open Beelden:** each item shows its licence. CC BY-SA means our *cut clip* must also be CC BY-SA. That's fine for the media file itself.

Add a **"Bronnen en licenties" (sources & licences) page** in Instellingen. It is required for CC BY/BY-SA.

## Asking NOS / creators for permission (worth a try)

The best real-world A2 content is **NOS Journaal in Makkelijke Taal**. It's a public broadcaster with a mission to reach newcomers. A short, friendly request may work for a free, non-commercial learning app:

- Ask for: use of a small number of audio fragments (e.g., 10 items of 1–2 min), with source credit, no ads, non-commercial.
- Contact: NOS via the address in their terms (reacties@nos.nl), or the NPO rights desk.
- The same approach works for learner podcasts (Zeg het in het Nederlands, etc.). Small creators often agree in exchange for a credit and a link.

Until there is a written yes: **link out** only (a "Luister ook" card with a link to NPO Start / nos.nl).

## Suggested next steps

1. Decide on the TTS engine. Proposal: Azure (quality), with Piper as the free/offline alternative. Generate 3 sample dialogues in both and compare them.
2. Define the `luisteren` JSON schema + validator, and an `npm run audio` script (script JSON → SSML → TTS → ffmpeg → `public/audio/...`). It should only regenerate changed clips (hash of the script text + voice).
3. Write the first unit (~8 clips) based on the DUO Luisteren A2 format.
4. Add a credits page. Then, optionally, import Lingua Libre word audio for the vocabulary list.
5. Send the permission request to NOS (optional, in parallel).

## Sources

- [NOS Journaal in Makkelijke Taal van start (NOS)](https://nos.nl/l/2536458) · [DutchNews](https://www.dutchnews.nl/2024/09/nos-begins-daily-news-bulletin-in-easy-to-follow-dutch) · [IamExpat](https://www.iamexpat.nl/expat-info/dutch-news/dutch-broadcaster-nos-launches-news-programme-easy-dutch) · [RefugeeHelp](https://www.refugeehelp.nl/en/asylum-seeker/news/100450-learn-dutch-better-now-with-the-nos-news-in-easy-language)
- [NOS Algemene Voorwaarden 2025](https://over.nos.nl/wp-content/uploads/2025/10/NOS-Algemene-Voorwaarden-2025.pdf) · [NOS voorwaarden 2021](https://over.nos.nl/wp-content/uploads/2021/02/Algemene-voorwaarden-NOS.pdf) · [NPO on downloading streams (Telecompaper)](https://www.telecompaper.com/news/npo-zet-streep-door-downloaden-streaming-videocontent--1285142) · [RUG: audio & video in education](https://www.rug.nl/library/publish/copyright/reader-support/bronnen/audio-video?lang=en)
- [Common Voice Scripted Speech 23.0 – Dutch](https://datacollective.mozillafoundation.org/datasets/cmflnuzw612cjai01qcld1gt5)
- [Lingua Libre (Wikipedia)](https://en.wikipedia.org/wiki/Lingua_Libre)
- [Tatoeba downloads](https://tatoeba.org/ca/downloads) · [manythings.org audio sentences](https://www.manythings.org/audiosentences/)
- [Open Beelden FAQ](https://openbeelden.nl/help) · [Open Images dataset](https://data.beeldengeluid.nl/datasets/open-beelden)
- [Piper voices (Hugging Face)](https://huggingface.co/rhasspy/piper-voices/tree/293cad0539066f86e6bce3b9780c472cc9157489/nl) · [Piper nl_NL MLS model card](https://huggingface.co/rhasspy/piper-voices/blob/5e74c24a88ed7d31e308633fa1542433ce2b28d4/nl/nl_NL/mls_7432/low/MODEL_CARD)
- [Azure TTS commercial use (Microsoft Q&A)](https://learn.microsoft.com/en-us/answers/questions/2124037/can-i-use-azure-text-to-speech-to-generate-mp3-for-commercial-use) · [Azure TTS code of conduct](https://learn.microsoft.com/ko-kr/legal/cognitive-services/speech-service/text-to-speech/code-of-conduct)
- [YouTube downloads & Creative Commons (TechSmith)](https://www.techsmith.com/blog/download-youtube-videos/)
- [DUO A2 practice exams overview (inburgering.org)](https://inburgering.org/exam-info/a2-inburgering-official-practice-exams)
- [Dutch learner podcasts (DutchReview)](https://dutchreview.com/expat/learn-dutch/podcasts-learn-dutch/)
