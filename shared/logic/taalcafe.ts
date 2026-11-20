/**
 * Taalcafé: a small-talk chat with Sanne, a volunteer in a Dutch language café (needs a Claude key).
 * The topics and Sanne's first lines are course content, so they are Dutch only.
 */
export interface TaalcafeTopic {
  id: string;
  emoji: string;
  title: string;
  /** Sanne's first line: the learner never faces an empty chat. */
  opener: string;
}

export const TAALCAFE_PARTNER = "Sanne";

export const TAALCAFE_TOPICS: TaalcafeTopic[] = [
  { id: "kennismaken", emoji: "👋", title: "Kennismaken", opener: "Hoi! Ik ben Sanne. Welkom in het taalcafé. Hoe heet jij, en waar kom je vandaan?" },
  { id: "weer", emoji: "🌦️", title: "Het weer", opener: "Hoi! Wat een weer vandaag, hè? Hoe vind jij het weer in Nederland?" },
  { id: "weekend", emoji: "📅", title: "Het weekend", opener: "Hoi! Fijn dat je er bent. Wat heb je afgelopen weekend gedaan?" },
  { id: "werk", emoji: "💼", title: "Werk en school", opener: "Hoi! Ik werk zelf in een bibliotheek. Werk jij, of volg je een opleiding?" },
  { id: "familie", emoji: "👨‍👩‍👧", title: "Familie", opener: "Hoi! Ik heb twee kinderen, van 6 en 9 jaar. Heb jij familie in Nederland?" },
  { id: "eten", emoji: "🍲", title: "Eten en koken", opener: "Hoi! Ik heb vandaag soep gemaakt. Wat eet jij graag?" },
  { id: "vrije-tijd", emoji: "⚽", title: "Vrije tijd", opener: "Hoi! Ik fiets graag, en ik zing in een koor. Wat doe jij graag in je vrije tijd?" },
  { id: "buurt", emoji: "🏘️", title: "Wonen en de buurt", opener: "Hoi! Ik woon hier vlakbij. In welke buurt woon jij? Vind je het er leuk?" },
  { id: "vakantie", emoji: "🏖️", title: "Vakantie en feestdagen", opener: "Hoi! Binnenkort is het vakantie. Ga jij ergens naartoe, of blijf je thuis?" },
];

/** A conversation stops after this many learner messages: it keeps the cost of one chat small. */
export const TAALCAFE_MAX_TURNS = 20;
/** Only the last messages go to Claude: enough for the thread of the talk, without the cost growing with every turn. */
export const TAALCAFE_HISTORY = 16;
export const TAALCAFE_MAX_LENGTH = 400;

export const taalcafeTopic = (id: string) => TAALCAFE_TOPICS.find((t) => t.id === id);
