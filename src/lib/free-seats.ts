import type { Lang } from "@/lib/events";

/** "3 prosta mesta" / "3 free seats" (Slovenian dual and plural by last two digits). */
export function freeSeatsLabel(n: number, lang: Lang, short = false): string {
  if (lang === "en") return short ? `${n} free` : `${n} free ${n === 1 ? "seat" : "seats"}`;
  const m = n % 100;
  const [adj, noun] = m === 1 ? ["prosto", "mesto"] : m === 2 ? ["prosti", "mesti"] : m === 3 || m === 4 ? ["prosta", "mesta"] : ["prostih", "mest"];
  return short ? `${n} ${adj}` : `${n} ${adj} ${noun}`;
}
