const SLOVENIAN_MONTHS = [
  "januar", "februar", "marec", "april", "maj", "junij",
  "julij", "avgust", "september", "oktober", "november", "december"
];

export function formatSlovenianDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${day}. ${SLOVENIAN_MONTHS[month - 1]} ${year}`;
}
