const KNM: Record<string, string> = {
  werk: "Werk en inkomen",
  omgang: "Omgangsvormen, waarden en normen",
  wonen: "Wonen",
  gezondheid: "Gezondheid en gezondheidszorg",
  geschiedenis: "Geschiedenis en geografie",
  instanties: "Instanties",
  staat: "Staatsinrichting en rechtsstaat",
  onderwijs: "Onderwijs en opvoeding",
};
const LEZEN: Record<string, string> = {
  brief: "Brieven",
  email: "E-mails",
  advertentie: "Advertenties",
  mededeling: "Mededelingen",
  rooster: "Roosters",
  folder: "Folders",
  formulier: "Formulieren",
  artikel: "Artikelen",
  bericht: "Berichten",
};

/** "knm:wonen" → "Wonen" */
export function themeLabel(tag: string): string {
  const [kind, name] = tag.split(":");
  return (kind === "knm" ? KNM[name] : kind === "lezen" ? LEZEN[name] : undefined) ?? name ?? tag;
}

export const skillLabel: Record<string, string> = { lezen: "Lezen A2", knm: "KNM", schrijven: "Schrijven A2" };
export const skillEmoji: Record<string, string> = { lezen: "📖", knm: "🏛️", schrijven: "✍️" };

export const DISCLAIMER = "Dit is een oefenexamen. De echte score van DUO kan anders zijn.";

export function formatTime(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
