/** Single source of truth for plan limits and the founding offer. Site copy is built from these. */
export const PLAN_LIMITS = {
  free: { maxPlayers: 30, maxTeams: 2 },
  founding: { maxPlayers: 150, maxTeams: 3 }, // 3 teams work end to end (check-in, console, player screen)
  pro: { maxPlayers: 150, maxTeams: 3 },
} as const;

export const FOUNDING_OFFER = {
  until: "2027-03-31", // ISO date: last day of free Pro for founding fields
  discountPercent: 40, // discount for founding fields once billing starts, for as long as they stay
  spots: 20, // "first N fields"
};

export const CONTACT_EMAIL = "info@spartanopsapp.com";

const NL = "\r\n";

function mailto(subject: string, lines: string[]): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join(NL))}`;
}

/** mailto link for the founding-field application. extra is prefilled when known (signed-in marshal). */
export function foundingApplicationMailto(
  lang: "en" | "sl",
  extra?: { fieldName?: string; accountId?: string },
): string {
  const en = lang === "en";
  const head: string[] = [];
  if (extra?.fieldName) head.push(`Field: ${extra.fieldName}`);
  if (extra?.accountId) head.push(`Account: ${extra.accountId}`);
  const known = head.length > 0;
  const body = en
    ? [
        ...(known ? [] : ["Field name:"]),
        "Country / city:",
        "Typical players per game:",
        "Game days per month:",
        "Website or Facebook page:",
        "What would you most like SpartanOps to do for your field?",
      ]
    : [
        ...(known ? [] : ["Ime poligona:"]),
        "Država / mesto:",
        "Običajno število igralcev na igro:",
        "Število igralnih dni na mesec:",
        "Spletna stran ali Facebook:",
        "Kaj bi si najbolj želel/a, da SpartanOps naredi za tvoj poligon?",
      ];
  return mailto(en ? "Founding field application" : "Prijava ustanovitvenega poligona", [...head, ...body]);
}

/** mailto link for big-event enquiries. */
export function eventLicenceMailto(lang: "en" | "sl"): string {
  const en = lang === "en";
  return mailto(
    en ? "Event licence enquiry" : "Povpraševanje za licenco za dogodek",
    en
      ? ["Event name and date:", "Expected players:", "What you need:"]
      : ["Ime in datum dogodka:", "Pričakovano število igralcev:", "Kaj potrebuješ:"],
  );
}

// Slovenian dates inside a sentence need the genitive month ("31. maja 2027"); Intl gives the nominative ("maj").
const SL_MONTHS_GENITIVE = [
  "januarja", "februarja", "marca", "aprila", "maja", "junija",
  "julija", "avgusta", "septembra", "oktobra", "novembra", "decembra",
] as const;

/** Founding offer end date, e.g. "31 March 2027" / "31. marca 2027". */
export function formatFoundingDate(lang: "en" | "sl"): string {
  const d = new Date(`${FOUNDING_OFFER.until}T12:00:00Z`);
  if (lang === "sl") return `${d.getUTCDate()}. ${SL_MONTHS_GENITIVE[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(d);
}
