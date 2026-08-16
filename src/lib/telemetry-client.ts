import { bumpTelemetry, type TelemetryKind } from "@/lib/spartanops-telemetry.functions";

/**
 * Fire-and-forget marketing telemetry bump. Never throws and never blocks the
 * UI — the homepage "Operational Telemetry" counters are the only consumer.
 */
export function bumpTelemetryClient(kind: TelemetryKind, dedupeKey?: string): void {
  if (typeof window === "undefined") return;
  try {
    void bumpTelemetry({ data: dedupeKey ? { kind, dedupeKey } : { kind } }).catch(() => {});
  } catch {
    /* ignore */
  }
}

/** Bump at most once per browser tab for the given local key. */
export function bumpTelemetryOnce(kind: TelemetryKind, localKey: string, dedupeKey?: string): void {
  if (typeof window === "undefined") return;
  const k = `spartanops:tlm:${kind}:${localKey}`;
  try {
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, "1");
  } catch {
    /* ignore */
  }
  bumpTelemetryClient(kind, dedupeKey);
}
