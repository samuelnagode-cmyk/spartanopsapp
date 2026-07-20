/**
 * Best-effort in-memory sliding-window rate limiter for public email
 * endpoints. Keyed per isolate; not distributed, but blocks the trivial
 * scripted-abuse case (relay / spam of the trusted sender) documented in
 * the security scan. For hardened protection, layer a CAPTCHA on top.
 */
type Bucket = { hits: number[]; blockedUntil: number };
const buckets = new Map<string, Bucket>();

const WINDOW_MS = 10 * 60_000; // 10 minutes
const MAX_HITS = 5;            // max sends per key per window
const BLOCK_MS = 30 * 60_000;  // cool-down after tripping the limit

export function getClientKey(request: Request): string {
  const h = request.headers;
  const fwd =
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    (h.get("x-forwarded-for") ?? "").split(",")[0].trim();
  return fwd || "unknown";
}

/**
 * Returns { ok: true } to allow the request, or { ok: false, retryAfter }
 * to reject it with HTTP 429. Call once per accepted request just before
 * the outbound email send.
 */
export function checkEmailRateLimit(
  request: Request,
  extraKeyParts: string[] = [],
): { ok: true } | { ok: false; retryAfter: number } {
  const key = [getClientKey(request), ...extraKeyParts].join("|");
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { hits: [], blockedUntil: 0 };
    buckets.set(key, bucket);
  }
  if (bucket.blockedUntil > now) {
    return { ok: false, retryAfter: Math.ceil((bucket.blockedUntil - now) / 1000) };
  }
  bucket.hits = bucket.hits.filter((t) => now - t < WINDOW_MS);
  if (bucket.hits.length >= MAX_HITS) {
    bucket.blockedUntil = now + BLOCK_MS;
    return { ok: false, retryAfter: Math.ceil(BLOCK_MS / 1000) };
  }
  bucket.hits.push(now);

  // Opportunistic cleanup so the map does not grow unbounded.
  if (buckets.size > 5000) {
    for (const [k, b] of buckets) {
      if (b.blockedUntil < now && b.hits.every((t) => now - t >= WINDOW_MS)) {
        buckets.delete(k);
      }
    }
  }

  return { ok: true };
}
