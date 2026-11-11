export const RESPAWN_RESCAN_GUARD_MS = 10_000;

export function shouldIgnoreRespawnScan(i: {
  lastScanMs: number;
  lockUntilMs: number;
  nowMs: number;
}): boolean {
  return i.lockUntilMs > i.nowMs ||
    (i.lastScanMs > 0 && i.nowMs - i.lastScanMs < RESPAWN_RESCAN_GUARD_MS);
}