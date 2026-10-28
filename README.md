# Inburgering A2 Trainer

Een app om te oefenen voor het inburgeringsexamen (A2): **Lezen**, **Luisteren**, **KNM** en **Schrijven**.
Niet van DUO. Alle teksten en vragen zijn zelf gemaakt.

*An app to practise for the Dutch civic integration exam (A2): reading, listening, KNM (knowledge of Dutch society) and writing. Not affiliated with DUO.*

## Hoe werkt het?

- De app is een **website zonder server**. Alles gebeurt in je eigen browser.
- Je **voortgang staat alleen in de browser** (IndexedDB) op dit apparaat. Er is geen account en er worden geen gegevens verstuurd.
- **Claude-hulp is optioneel** (feedback op teksten, uitleg, extra oefeningen). Je plakt je eigen
  Anthropic API-sleutel bij *Instellingen*. De sleutel wordt versleuteld op dit apparaat bewaard en gaat alleen naar Anthropic.
- Op twee apparaten leren? Druk op **Klaar voor vandaag**, bewaar het bestand (op een iPhone: deel het met AirDrop) en kies op het andere apparaat
  **Ga verder met een bestand**. De voortgang wordt samengevoegd; er gaat niets verloren.
- Weet je wanneer je examens zijn? Vul de datums in bij *Instellingen*. Op de startpagina zie je dan een **studieplan**:
  welke lessen en proefexamens je per week doet, zodat je op tijd klaar bent.
- Installeer de app op je beginscherm (zie Instellingen). Dan werkt hij ook zonder internet (behalve de Claude-hulp).

## Ontwikkelen

Vereist Node 24.

```bash
npm install
npm run dev          # Vite dev server op http://localhost:5173
npm test             # unit tests (Vitest)
npm run build        # type-check + productiebuild in dist/ (faalt als de cursusinhoud niet klopt)
npm run validate     # controleert alle cursusbestanden in data/course/
npm run check-ids    # faalt als een vaste id uit een eerdere versie verdwenen is
npm run e2e          # browsertests (Playwright, telefoonformaat; eerst: npx playwright install chromium)
npm run stats        # telt vragen, woorden en teksten t.o.v. de doelen
npm run illustrations # tekent de illustraties opnieuw (scripts/illustrations → src/assets/scenes en spots)
```

### Illustraties

Elke les begint met een tekening (een "scène"), en naast de oefeningen staat een kleine tekening, zoals in een taalboek. Alles is SVG en wordt met code getekend in `scripts/illustrations/`:

- `kit.ts`: achtergronden en voorwerpen (kamers, grachtenpanden, tafels, tekstballonnen…);
- `peeps.ts` + `peeps.json`: de mensen, gemaakt van [Open Peeps](https://www.openpeeps.com) van Pablo Stanley (CC0). `peeps-extract.ts` heeft `peeps.json` uit het Sketch-bestand van Open Peeps gehaald; dat hoeft alleen opnieuw voor nieuwe onderdelen;
- `scenes*.ts`: de scènes (480 × 320), `spots.ts`: de losse tekeningen naast oefeningen.

`npm run illustrations` schrijft de SVG's naar `src/assets/scenes/` en `src/assets/spots/`, met een `index.json` (alt-tekst per tekening). In een les gebruik je ze zo:

- `"scene": "keuken"` in een unit: de omslag (in de lijst met lessen en bovenaan de les);
- `{ "kind": "picture", "scene": "apotheek" }` als blok in een lesstap;
- `"spot": "hond"` in een oefening (anders kiest de app een tekening die bij het thema past).

De build faalt als een les een tekening noemt die niet bestaat.

### Luisterfragmenten

De module Luisteren werkt zoals het examen: je leest de situatie en de vragen, en dan luister je naar een fragment (een gesprek, telefoongesprek, voicemail, omroepbericht, de radio of een uitleg). Na het controleren zie je de tekst, met bij elke vraag de zin waar het antwoord staat. Een fragment schrijf je zo:

```json
{
  "type": "listening",
  "fragment": {
    "kind": "telefoon",
    "situation": "Yusuf belt de huisarts.",
    "speakers": [{ "name": "Assistente", "voice": "nathalie", "phone": true }, { "name": "Yusuf", "voice": "ronnie" }],
    "lines": [{ "speaker": "Assistente", "nl": "Huisartsenpraktijk De Linde, goedemorgen." }, { "speaker": "Yusuf", "nl": "…" }]
  },
  "questions": [{ "type": "mc", "prompt": "…", "options": ["…"], "answer": 1, "explanation": "…", "answerLine": 2 }]
}
```

- Elke spreker heeft een eigen stem (`ronnie`, `alex` of `nathalie`; nathalie is de enige vrouwenstem).
- `answerLine` is de regel (vanaf 0) waar het antwoord staat. Schrijf getallen en tijden in woorden ("kwart over elf"); in de antwoorden als cijfers ("11.15 uur").
- Neem daarna de stemmen op met `npm run voice` (zie `scripts/tts/README.md`). Zonder opname leest het apparaat de zinnen voor.

### Meldingen van fouten verzamelen

Elke les en vraag heeft een knop **Meld een fout**. Die opent een ingevuld issue op GitHub (formulier: `.github/ISSUE_TEMPLATE/inhoud-fout.yml`), met de id van het onderdeel en een link naar het bestand in `data/course/`. De naam van een unit- of examenbestand moet daarom gelijk zijn aan de id erin; de build controleert dat.

Wie geen GitHub-account heeft, kan de melding op het apparaat bewaren. Die meldingen zitten in het voortgangsbestand. Om ze te lezen:

```bash
npm run flags -- voortgang-van-een-vriend.json [nog-een-bestand.json]
```

### Oude voortgang (serverversie) overzetten

Had je voortgang in de oude versie met een server (`data/user/`)? Maak er een bestand van en importeer het in de app:

```bash
npm run migrate-old-progress -- data/user
```

## Online zetten met Netlify

De site is statisch (geen server). `netlify.toml` bevat alle instellingen; de beveiligingsheaders (`Content-Security-Policy` e.d.) worden bij de build in `dist/_headers` gezet.

1. Zet de code op GitHub en kies in Netlify **Add new site → Import an existing project**.
2. Kies de repository en de branch `main`. Build command (`npm run build`), publish directory (`dist`) en Node 24 komen uit `netlify.toml`.
3. Elke push naar `main` publiceert automatisch. Pull requests krijgen een eigen **deploy preview**-link.
4. De build faalt als de cursusinhoud niet klopt, en GitHub Actions (`.github/workflows/ci.yml`) draait daarnaast de tests en de browsertests. Zet in GitHub bij *Settings → Branches* "Require status checks" aan als je wilt dat Netlify alleen groene commits publiceert.

Vrienden gebruiken de site met hun **eigen** API-sleutel; die komt nooit op een server van jou.

## Waar staat wat?

| Map | Inhoud |
| --- | --- |
| `data/course/` | De cursus: lessen, woorden, werkwoorden, proefexamens (JSON) en je samenvatting (Markdown) |
| `shared/` | Logica zonder browser of server: spaced repetition, nakijken, samenvoegen, services en de Claude-prompts |
| `src/` | De Vue-app: schermen, componenten, de Dexie-database en de sleutelkluis |
| `scripts/` | Hulpscripts: cursus valideren, tellen, meldingen lezen, en de Vite-plug-in die de cursus bundelt |
| `docs/production-readiness.md` | Het plan en de beslissingen achter de overstap naar "local-first" |
| `SPEC.md` | De oorspronkelijke specificatie (de serverversie; zie de notities bovenaan) |
