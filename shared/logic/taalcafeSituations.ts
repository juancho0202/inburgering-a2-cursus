/**
 * Taalcafé situations: role-play with a mission. Claude plays the other person (the pharmacist, the conductor, …);
 * the learner has three goals to reach in Dutch. The twist is told only to Claude: something changes on the way,
 * like in the exam. All of it is course content, so Dutch only.
 */
export type SituationGroupId = "winkels" | "onderweg" | "gezondheid" | "wonen" | "vrije-tijd" | "werk-school" | "feestjes";

export interface TaalcafeSituation {
  id: string;
  group: SituationGroupId;
  emoji: string;
  title: string;
  /** Who Claude plays: a first name and what they do. */
  partner: { name: string; role: string };
  /** A stranger in a shop or at a desk says u, and expects u back. */
  formal: boolean;
  /** A phone call: no face, no pointing, names and numbers must be said. */
  phone?: boolean;
  /** What the learner reads before the talk starts. */
  setting: string;
  opener: string;
  goals: { id: string; text: string }[];
  /** For Claude only: the complication it brings in once, on a natural moment. */
  twist: string;
}

export const SITUATION_GROUPS: { id: SituationGroupId; title: string }[] = [
  { id: "winkels", title: "Winkels en geld" },
  { id: "onderweg", title: "Onderweg" },
  { id: "gezondheid", title: "Gezondheid" },
  { id: "wonen", title: "Wonen" },
  { id: "vrije-tijd", title: "Vrije tijd" },
  { id: "werk-school", title: "Werk en school" },
  { id: "feestjes", title: "Feestjes" },
];

export const TAALCAFE_SITUATIONS: TaalcafeSituation[] = [
  // ---- Winkels en geld
  {
    id: "kassa", group: "winkels", emoji: "🛒", title: "Afrekenen bij de kassa",
    partner: { name: "Daan", role: "kassamedewerker in de supermarkt" }, formal: true,
    setting: "Je staat bij de kassa van de supermarkt. Je boodschappen liggen op de band.",
    opener: "Goedemiddag! Heeft u een bonuskaart?",
    goals: [
      { id: "bonuskaart", text: "Zeg of je een bonuskaart hebt" },
      { id: "tasje", text: "Vraag om een tasje" },
      { id: "betalen", text: "Betaal, en zeg of je de bon wilt" },
    ],
    twist: "Het pinapparaat doet het even niet. Vraag of de klant contant kan betalen, of even wil wachten.",
  },
  {
    id: "bakker", group: "winkels", emoji: "🥖", title: "Brood kopen bij de bakker",
    partner: { name: "Marieke", role: "verkoopster bij de bakker" }, formal: true,
    setting: "Je bent bij de bakker. Je wilt een half bruin brood, gesneden.",
    opener: "Goedemorgen, wie mag ik helpen?",
    goals: [
      { id: "bestellen", text: "Bestel een half brood, gesneden" },
      { id: "prijs", text: "Vraag wat het kost" },
      { id: "betalen", text: "Betaal en neem afscheid" },
    ],
    twist: "Het bruine brood is op. Bied volkoren of wit brood aan.",
  },
  {
    id: "ruilen", group: "winkels", emoji: "👖", title: "Een broek ruilen",
    partner: { name: "Kevin", role: "verkoper in een kledingwinkel" }, formal: true,
    setting: "Je hebt vorige week een broek gekocht. Hij is te klein. Je wilt een grotere maat.",
    opener: "Hallo, kan ik u helpen?",
    goals: [
      { id: "probleem", text: "Zeg wat het probleem is" },
      { id: "maat", text: "Vraag om een grotere maat" },
      { id: "wanneer", text: "Vertel wanneer je de broek kocht" },
    ],
    twist: "Vraag om de kassabon. De klant heeft die niet meer: u kunt het opzoeken als de klant weet op welke dag hij met de pinpas betaalde.",
  },
  {
    id: "pakket", group: "winkels", emoji: "📦", title: "Een pakket ophalen",
    partner: { name: "Sem", role: "medewerker van een pakketpunt" }, formal: true,
    setting: "Je was niet thuis toen je pakket kwam. Nu ligt het bij een pakketpunt in de supermarkt.",
    opener: "Goedemiddag, komt u iets ophalen?",
    goals: [
      { id: "ophalen", text: "Zeg dat je een pakket komt ophalen" },
      { id: "code", text: "Geef je naam of je afhaalcode" },
      { id: "id", text: "Laat zien wie je bent" },
    ],
    twist: "De scanner doet het niet. Vraag de klant om de afhaalcode langzaam op te lezen.",
  },
  // ---- Onderweg
  {
    id: "hoofdconducteur", group: "onderweg", emoji: "🚆", title: "Een vraag aan de hoofdconducteur",
    partner: { name: "meneer Visser", role: "hoofdconducteur in de trein" }, formal: true,
    setting: "Je zit in de trein naar Utrecht. Daar moet je overstappen naar Zwolle. De trein heeft vertraging.",
    opener: "Goedemiddag, mag ik uw vervoersbewijs zien?",
    goals: [
      { id: "kaartje", text: "Laat je kaartje of je pas zien" },
      { id: "overstap", text: "Vraag of je de overstap in Utrecht haalt" },
      { id: "andere-trein", text: "Vraag welke trein je dan moet nemen" },
    ],
    twist: "De reiziger haalt de trein naar Zwolle niet. De volgende trein naar Zwolle gaat een half uur later.",
  },
  {
    id: "inchecken", group: "onderweg", emoji: "💳", title: "Vergeten in te checken",
    partner: { name: "mevrouw De Jong", role: "conducteur in de trein" }, formal: true,
    setting: "Je zit in de trein. Je ziet dat je vergeten bent in te checken met je pas.",
    opener: "Goedemorgen, de vervoersbewijzen alstublieft.",
    goals: [
      { id: "uitleggen", text: "Leg uit dat je vergeten bent in te checken" },
      { id: "station", text: "Zeg op welk station je bent ingestapt" },
      { id: "wat-nu", text: "Vraag wat je nu moet doen" },
    ],
    twist: "Zonder geldig vervoersbewijs moet u een boete geven. Vraag rustig om een legitimatiebewijs, en zeg dat de reiziger achteraf bezwaar kan maken bij NS.",
  },
  {
    id: "fietsenmaker", group: "onderweg", emoji: "🚲", title: "Bij de fietsenmaker",
    partner: { name: "Ahmed", role: "fietsenmaker" }, formal: true,
    setting: "Je fiets heeft een lekke band. Je brengt hem naar de fietsenmaker.",
    opener: "Hoi, wat kan ik voor u doen?",
    goals: [
      { id: "kapot", text: "Vertel wat er kapot is" },
      { id: "klaar", text: "Vraag wanneer de fiets klaar is" },
      { id: "kosten", text: "Vraag wat het kost" },
    ],
    twist: "U ziet dat ook de remmen bijna versleten zijn. Vraag of u die ook moet maken; dat kost meer.",
  },
  // ---- Gezondheid
  {
    id: "apotheek", group: "gezondheid", emoji: "💊", title: "Medicijnen ophalen bij de apotheek",
    partner: { name: "Ilse", role: "assistent bij de apotheek" }, formal: true,
    setting: "De huisarts heeft een recept naar de apotheek gestuurd. Je komt je medicijnen ophalen.",
    opener: "Goedemorgen, waar kan ik u mee helpen?",
    goals: [
      { id: "ophalen", text: "Zeg dat je medicijnen komt ophalen" },
      { id: "gegevens", text: "Geef je naam en je geboortedatum" },
      { id: "hoe-vaak", text: "Vraag hoe vaak je het medicijn moet nemen" },
    ],
    twist: "Eén van de twee medicijnen is nog niet binnen. Vraag of de klant morgen terugkomt, of dat u het laat bezorgen.",
  },
  {
    id: "huisarts-bellen", group: "gezondheid", emoji: "🩺", title: "De huisarts bellen",
    partner: { name: "Fatma", role: "doktersassistente bij de huisartsenpraktijk" }, formal: true, phone: true,
    setting: "Je hebt al vier dagen koorts en je hoest veel. Je belt de huisarts voor een afspraak.",
    opener: "Huisartsenpraktijk De Linde, goedemorgen, u spreekt met Fatma.",
    goals: [
      { id: "wie-waarom", text: "Zeg je naam en waarom je belt" },
      { id: "hoe-lang", text: "Vertel hoe lang je al ziek bent" },
      { id: "afspraak", text: "Maak een afspraak" },
    ],
    twist: "Vraag eerst hoe hoog de koorts is. Vandaag is er alleen om kwart voor vijf nog plek; anders morgen om kwart over negen.",
  },
  {
    id: "tandarts-verzetten", group: "gezondheid", emoji: "🦷", title: "Een afspraak verzetten",
    partner: { name: "Linda", role: "assistente bij de tandarts" }, formal: true, phone: true,
    setting: "Je hebt donderdag om tien uur een afspraak bij de tandarts. Maar je moet dan werken.",
    opener: "Tandartspraktijk Het Plein, goedemiddag.",
    goals: [
      { id: "verzetten", text: "Zeg dat je je afspraak wilt verzetten" },
      { id: "wanneer", text: "Zeg wanneer je wel kunt" },
      { id: "herhalen", text: "Herhaal de nieuwe dag en tijd" },
    ],
    twist: "De eerste dag die de klant noemt, is vol. Bied twee andere tijden aan.",
  },
  // ---- Wonen
  {
    id: "verwarming", group: "wonen", emoji: "🔥", title: "De verwarming is kapot",
    partner: { name: "Jeroen", role: "medewerker van de woningcorporatie" }, formal: true, phone: true,
    setting: "Het is winter. De verwarming in je huurhuis doet het al twee dagen niet. Je belt de woningcorporatie.",
    opener: "Woonstichting De Hof, goedemorgen, u spreekt met Jeroen.",
    goals: [
      { id: "probleem", text: "Vertel wat het probleem is" },
      { id: "adres", text: "Geef je adres" },
      { id: "monteur", text: "Spreek een tijd af voor de monteur" },
    ],
    twist: "Vraag eerst of de klant de druk van de ketel heeft bekeken. De monteur kan pas overmorgen, tussen acht en twaalf uur.",
  },
  {
    id: "pakketje-buren", group: "wonen", emoji: "🏠", title: "Een pakketje voor de buren",
    partner: { name: "Anneke", role: "je buurvrouw" }, formal: false,
    setting: "Je hebt een pakketje voor je buurvrouw aangenomen. Je belt bij haar aan.",
    opener: "Hé, hallo! Wat leuk dat je aanbelt.",
    goals: [
      { id: "pakketje", text: "Zeg dat je een pakketje voor haar hebt" },
      { id: "wanneer", text: "Vertel wanneer het kwam" },
      { id: "praatje", text: "Maak een kort praatje" },
    ],
    twist: "Het pakketje is niet voor jou, maar voor de buren op nummer 14. Stel voor om het samen te brengen.",
  },
  {
    id: "verhuizing", group: "wonen", emoji: "🏛️", title: "Je verhuizing doorgeven",
    partner: { name: "meneer Bakker", role: "medewerker bij de balie van de gemeente" }, formal: true,
    setting: "Je bent verhuisd naar een andere straat in dezelfde stad. Je staat bij de balie van de gemeente.",
    opener: "Goedemorgen, waarmee kan ik u helpen?",
    goals: [
      { id: "verhuisd", text: "Zeg dat je verhuisd bent" },
      { id: "adres-datum", text: "Geef je nieuwe adres en de datum" },
      { id: "id", text: "Laat zien wie je bent" },
    ],
    twist: "Vraag of er nog meer mensen meeverhuizen, zoals een partner of kinderen.",
  },
  // ---- Vrije tijd
  {
    id: "ijsbaan", group: "vrije-tijd", emoji: "⛸️", title: "Kaartjes kopen bij de ijsbaan",
    partner: { name: "Lotte", role: "medewerker aan de kassa van de ijsbaan" }, formal: true,
    setting: "Je gaat schaatsen met je dochter van acht. Jullie hebben geen schaatsen.",
    opener: "Goedemiddag! Hoeveel kaartjes wilt u?",
    goals: [
      { id: "kaartjes", text: "Koop een kaartje voor een volwassene en een kind" },
      { id: "schaatsen", text: "Huur twee paar schaatsen en noem de maten" },
      { id: "dicht", text: "Vraag hoe laat de ijsbaan dichtgaat" },
    ],
    twist: "Schaatsen in de kindermaat die de klant noemt, zijn op. Bied een maat groter aan, met dikke sokken.",
  },
  {
    id: "cafe", group: "vrije-tijd", emoji: "☕", title: "Bestellen en afrekenen in een café",
    partner: { name: "Bas", role: "ober in een café" }, formal: true,
    setting: "Je zit met een vriendin op het terras van een café.",
    opener: "Hoi! Weten jullie al wat jullie willen drinken?",
    goals: [
      { id: "drinken", text: "Bestel twee drankjes" },
      { id: "eten", text: "Vraag of er iets te eten is" },
      { id: "rekening", text: "Vraag om de rekening, en betaal ieder apart" },
    ],
    twist: "De keuken is al dicht. Er zijn alleen nog bitterballen.",
  },
  {
    id: "bibliotheek", group: "vrije-tijd", emoji: "📚", title: "Lid worden van de bibliotheek",
    partner: { name: "Ellen", role: "medewerker van de bibliotheek" }, formal: true,
    setting: "Je wilt boeken lenen. Je bent bij de balie van de bibliotheek.",
    opener: "Goedemiddag, kan ik u helpen?",
    goals: [
      { id: "lid", text: "Zeg dat je lid wilt worden" },
      { id: "kosten", text: "Vraag wat het kost" },
      { id: "lenen", text: "Vraag hoe lang je een boek mag lenen" },
    ],
    twist: "Vraag om een legitimatiebewijs. Vertel ook dat kinderen tot 18 jaar gratis lid zijn.",
  },
  {
    id: "kapper", group: "vrije-tijd", emoji: "💇", title: "Een afspraak bij de kapper",
    partner: { name: "Nina", role: "kapster" }, formal: true, phone: true,
    setting: "Je haar is te lang. Je belt de kapper voor een afspraak.",
    opener: "Kapsalon Knip, goedemiddag, met Nina.",
    goals: [
      { id: "afspraak", text: "Zeg dat je een afspraak wilt om je haar te laten knippen" },
      { id: "dag-tijd", text: "Spreek een dag en een tijd af" },
      { id: "naam-nummer", text: "Geef je naam en je telefoonnummer" },
    ],
    twist: "Zaterdag is helemaal vol. Bied vrijdagavond of maandagochtend aan.",
  },
  // ---- Werk en school
  {
    id: "ziekmelden", group: "werk-school", emoji: "🤒", title: "Je ziek melden",
    partner: { name: "Marco", role: "je leidinggevende" }, formal: false, phone: true,
    setting: "Je bent ziek en kunt vandaag niet werken. Je belt je leidinggevende, voor je dienst begint.",
    opener: "Met Marco.",
    goals: [
      { id: "ziek", text: "Zeg dat je ziek bent en niet komt werken" },
      { id: "bereikbaar", text: "Zeg of je bereikbaar bent" },
      { id: "terugbellen", text: "Spreek af wanneer je weer belt" },
    ],
    twist: "Vraag of de cursist een belangrijke taak van vandaag aan een collega kan overdragen, en aan wie.",
  },
  {
    id: "tien-minutengesprek", group: "werk-school", emoji: "🏫", title: "Het 10-minutengesprek",
    partner: { name: "juf Esther", role: "de juf van je zoon in groep 5" }, formal: true,
    setting: "Je zit bij de juf van je zoon Yusuf voor het 10-minutengesprek.",
    opener: "Fijn dat u er bent! Hoe vindt Yusuf het op school?",
    goals: [
      { id: "thuis", text: "Vertel hoe je zoon het thuis over school heeft" },
      { id: "lezen", text: "Vraag hoe het met lezen gaat" },
      { id: "helpen", text: "Vraag wat je thuis kunt doen" },
    ],
    twist: "Vertel dat Yusuf vaak moe is in de klas, en vraag hoe laat hij naar bed gaat.",
  },
  {
    id: "eerste-werkdag", group: "werk-school", emoji: "👋", title: "Je eerste werkdag",
    partner: { name: "Tim", role: "een nieuwe collega" }, formal: false,
    setting: "Het is je eerste dag op je nieuwe werk. Een collega komt naar je toe.",
    opener: "Hoi! Jij bent de nieuwe collega, toch? Ik ben Tim.",
    goals: [
      { id: "voorstellen", text: "Stel jezelf voor" },
      { id: "spullen", text: "Vraag waar je je jas en tas kunt laten" },
      { id: "pauze", text: "Vraag hoe laat de pauze is" },
    ],
    twist: "Vraag of de cursist vrijdag meedoet aan de lunch met het team, waar iedereen iets te eten meeneemt.",
  },
  // ---- Feestjes
  {
    id: "verjaardag", group: "feestjes", emoji: "🎂", title: "Op een verjaardag",
    partner: { name: "Ria", role: "je buurvrouw, die jarig is" }, formal: false,
    setting: "Je buurvrouw Ria is jarig. Je komt binnen. Iedereen zit in een kring in de kamer.",
    opener: "Hé, wat leuk dat je er bent! Kom binnen!",
    goals: [
      { id: "feliciteren", text: "Feliciteer Ria met haar verjaardag" },
      { id: "cadeau", text: "Geef je cadeautje en zeg er iets bij" },
      { id: "over-jezelf", text: "Vertel iets over jezelf aan iemand uit de kring" },
    ],
    twist: "Bied koffie en taart aan, en vraag of de cursist melk en suiker wil. Stel daarna je zus Joke voor, die naast de cursist zit.",
  },
  {
    id: "buurtfeest", group: "feestjes", emoji: "🎉", title: "Het buurtfeest",
    partner: { name: "Henk", role: "een buurman uit je straat" }, formal: false,
    setting: "Er is een buurtfeest in je straat. Je staat bij de tafel met eten. Een buurman die je nog niet kent, komt naast je staan.",
    opener: "Lekker weer voor een feestje, hè? Ik ben Henk, van nummer 8.",
    goals: [
      { id: "voorstellen", text: "Stel jezelf voor en zeg waar je woont" },
      { id: "vragen", text: "Stel Henk een vraag over de buurt" },
      { id: "afspreken", text: "Spreek iets af, of zeg gedag" },
    ],
    twist: "Vertel dat er volgende maand een opruimdag in de straat is, en vraag of de cursist ook meehelpt.",
  },
];

export const taalcafeSituation = (id: string) => TAALCAFE_SITUATIONS.find((s) => s.id === id);
