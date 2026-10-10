import { todayLjubljana } from "./plans";

/** One calendar month after the given ISO date (or today if empty/past), clamped to month end. */
export function addOneMonth(iso: string, now = new Date()): string {
  const today = todayLjubljana(now);
  const base = /^\d{4}-\d{2}-\d{2}$/.test(iso) && iso >= today ? iso : today;
  const [y, m, d] = base.split("-").map(Number);
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate();
  return `${ny}-${String(nm).padStart(2, "0")}-${String(Math.min(d, last)).padStart(2, "0")}`;
}
