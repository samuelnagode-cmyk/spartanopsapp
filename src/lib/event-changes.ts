/** Pure: did an event's time or place change? No imports. */
export type ChangeSnapshot = {
  starts_at: string | null; ends_at: string | null;
  location_text: string | null; lat: number | null; lng: number | null;
};

const TOL = 0.00001;

function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return a == null && b == null;
  return Date.parse(a) === Date.parse(b);
}
function sameNum(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null || b == null) return a == null && b == null;
  return Math.abs(Number(a) - Number(b)) <= TOL;
}
const text = (s: string | null | undefined) => (s ?? "").trim();

export function diffEventChanges(prev: ChangeSnapshot, next: ChangeSnapshot): { time: boolean; place: boolean } {
  return {
    time: !sameInstant(prev.starts_at, next.starts_at) || !sameInstant(prev.ends_at, next.ends_at),
    place: text(prev.location_text) !== text(next.location_text) || !sameNum(prev.lat, next.lat) || !sameNum(prev.lng, next.lng),
  };
}
