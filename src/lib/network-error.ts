const NETWORK_PATTERN = /failed to fetch|load failed|networkerror|network request failed|network error|timeout/i;

/** True when a failed request most likely never got an answer because of the connection. */
export function isNetworkError(e: unknown, onLine: boolean): boolean {
  if (!onLine) return true;
  if (e instanceof TypeError) return true;
  const message = typeof e === "object" && e !== null && "message" in e ? (e as { message?: unknown }).message : undefined;
  return typeof message === "string" && NETWORK_PATTERN.test(message);
}
