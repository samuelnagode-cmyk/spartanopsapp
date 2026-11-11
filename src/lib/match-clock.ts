export type MatchPhase = "inactive" | "prestart" | "live" | "paused" | "timeup" | "ended";

export type MatchClock = {
  phase: MatchPhase;
  countdownSec: number;
  remainingSec: number;
  elapsedSec: number;
  durationSec: number;
};

/** Pure match clock; same rules as the players' screen and LiveMatchView. */
export function matchClock(i: {
  status: string | null | undefined;
  matchStartedAtMs: number | null;
  durationMin: number;
  nowMs: number;
  pausedAtMs: number | null;
}): MatchClock {
  const durationSec = Math.max(0, Math.round((i.durationMin || 0) * 60));
  const start = i.matchStartedAtMs;
  const elapsedAt = (t: number, s: number) =>
    Math.min(durationSec, Math.max(0, Math.floor((t - s) / 1000)));

  if (i.status === "ended") {
    return { phase: "ended", countdownSec: 0, remainingSec: 0, elapsedSec: durationSec, durationSec };
  }
  if (i.status === "paused" && start != null) {
    const elapsedSec = elapsedAt(i.pausedAtMs ?? i.nowMs, start);
    return { phase: "paused", countdownSec: 0, remainingSec: durationSec - elapsedSec, elapsedSec, durationSec };
  }
  if (i.status === "active" && start != null) {
    if (i.nowMs < start) {
      return { phase: "prestart", countdownSec: Math.ceil((start - i.nowMs) / 1000), remainingSec: durationSec, elapsedSec: 0, durationSec };
    }
    const elapsedSec = elapsedAt(i.nowMs, start);
    const remainingSec = durationSec - elapsedSec;
    return { phase: remainingSec > 0 ? "live" : "timeup", countdownSec: 0, remainingSec, elapsedSec, durationSec };
  }
  return { phase: "inactive", countdownSec: 0, remainingSec: durationSec, elapsedSec: 0, durationSec };
}

/** mm:ss with minutes padded to two digits (120:00 allowed). */
export function formatMmSs(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
