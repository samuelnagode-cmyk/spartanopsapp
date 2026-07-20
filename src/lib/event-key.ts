// Compose a stable identifier for events in the external `events` table,
// which has no `id` column. Same input → same output everywhere so the
// modal, attendee list and admin grouping all share the same key.
export function makeEventKey(row: { date?: string | null; title_sl?: string | null }): string {
  const date = (row.date ?? "").trim();
  const slug = (row.title_sl ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
  return `${date}|${slug}`;
}
