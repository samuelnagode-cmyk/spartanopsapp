const CODE_RE = /^[A-Za-z2-9]{6}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Turn a scanned poster QR into an app-relative /field path, or null.
 * Only the pathname and the code/id params are used — never the scanned host.
 */
export function parseFieldLink(raw: string): string | null {
  if (typeof raw !== "string") return null;
  const text = raw.trim();
  if (!text || text.length > 2048) return null;
  let url: URL;
  try {
    url = new URL(text, "https://spartanopsapp.com");
  } catch {
    return null;
  }
  if (url.pathname.replace(/\/+$/, "") !== "/field") return null;
  const code = (url.searchParams.get("code") ?? "").trim();
  if (CODE_RE.test(code)) return `/field?code=${code.toUpperCase()}`;
  const id = (url.searchParams.get("id") ?? "").trim();
  if (UUID_RE.test(id)) return `/field?id=${id.toLowerCase()}`;
  return null;
}
