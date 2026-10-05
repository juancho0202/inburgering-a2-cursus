# Inburgering A2 Trainer

Een app om te oefenen voor het inburgeringsexamen (A2): **Lezen**, **KNM** en **Schrijven**.
Niet van DUO. Alle teksten en vragen zijn zelf gemaakt.

*An app to practise for the Dutch civic integration exam (A2): reading, KNM (knowledge of Dutch society) and writing. Not affiliated with DUO.*

## Hoe werkt het?

- De app is een **website zonder server**. Alles gebeurt in je eigen browser.
- Je **voortgang staat alleen in de browser** (IndexedDB) op dit apparaat. Er is geen account en er worden geen gegevens verstuurd.
- **Claude-hulp is optioneel** (feedback op teksten, uitleg, extra oefeningen). Je plakt je eigen
  Anthropic API-sleutel bij *Instellingen*. De sleutel wordt versleuteld op dit apparaat bewaard en gaat alleen naar Anthropic.
- Op twee apparaten leren? Druk op **Klaar voor vandaag**, bewaar het bestand (op een iPhone: deel het met AirDrop) en kies op het andere apparaat
  **Ga verder met een bestand**. De voortgang wordt samengevoegd; er gaat niets verloren.
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
```

### Meldingen van fouten verzamelen

Elke les en vraag heeft een knop **Meld een fout**. De meldingen zitten in het voortgangsbestand. Om ze te lezen:

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
