type RankedPlayer = { pts: number; death_count?: number | null; callsign: string };

export function compareDebriefPlayers(a: RankedPlayer, b: RankedPlayer, deathsPublic: boolean): number {
  return b.pts - a.pts ||
    (deathsPublic ? (a.death_count ?? 0) - (b.death_count ?? 0) : 0) ||
    a.callsign.toLowerCase().localeCompare(b.callsign.toLowerCase());
}