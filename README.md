# Inburgering A2 Trainer

Een lokale app om te oefenen voor Lezen A2, KNM en Schrijven A2.

## Starten

```bash
npm install
npm run dev
```

Open daarna http://localhost:5173 in je browser.

## Waar staat je voortgang?

Al je voortgang staat lokaal in `data/user/`. Dit wordt nooit gedeeld.

- **Back-up maken**: kopieer de map `data/user/` naar een veilige plek.
- **Voortgang herstellen**: zet een gekopieerde `data/user/`-map terug op zijn plaats
  (de server moet dan gestopt zijn).
- **Voortgang resetten**: ga naar Instellingen → Reset, of verwijder `data/user/` handmatig
  (de app maakt dan nieuwe lege bestanden aan).

De server maakt elke dag automatisch een back-up in `data/user/backups/`.

## Een API-sleutel toevoegen

Ga naar **Instellingen** in de app en plak je Anthropic API-sleutel. De sleutel wordt
alleen op je eigen computer opgeslagen en nooit naar de browser gestuurd — alleen een
gemaskeerde versie (zoals `sk-ant-…abcd`) is zichtbaar.

Zonder sleutel werkt de hele app, behalve de Claude-functies (schrijffeedback, uitleg,
extra oefeningen).

## Andere commando's

| Commando | Werkt als |
| --- | --- |
| `npm run build` | Controleert types en bouwt de app voor productie |
| `npm start` | Start de app als één proces (voor dagelijks gebruik) |
| `npm run validate` | Controleert alle cursusinhoud op fouten |
| `npm run stats` | Laat zien hoeveel content er is per onderdeel |
| `npm test` | Draait de tests |

## Technische stack

Node 24, TypeScript, Vue 3 + Vite, Express 5, zod, JSON-bestanden als database
(geen databaseserver nodig). Zie `SPEC.md` voor de volledige specificatie.
