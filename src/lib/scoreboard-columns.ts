/**
 * Single source of truth for which per-player details a viewer may see.
 * Used by the HUD player tables, the debrief tables, the history log and
 * the share image. Pure: no JSX, no browser APIs.
 */
export type ScoreboardSettings = {
  capturePointsScoring?: boolean;
  respawn?: { enabled?: boolean; publicDeaths?: boolean; visibility?: "all" | "team" };
} | null | undefined;

/** Deaths are public only while respawn is on (a stale publicDeaths with respawn off counts as off). */
export function deathsEffectivelyPublic(settings: ScoreboardSettings): boolean {
  return !!settings?.respawn?.enabled && !!settings?.respawn?.publicDeaths;
}

export function scoreboardColumns(
  settings: ScoreboardSettings,
  rowTeam: string,
  viewerTeam: string | undefined,
): { points: boolean; deaths: boolean; respawnStatus: boolean } {
  const respawnOn = !!settings?.respawn?.enabled;
  const teamOnly = settings?.respawn?.visibility === "team";
  const sameTeam = !!viewerTeam && rowTeam === viewerTeam;
  return {
    points: !!settings?.capturePointsScoring,
    deaths: respawnOn && !!settings?.respawn?.publicDeaths && (!teamOnly || sameTeam),
    respawnStatus: respawnOn && (!teamOnly || sameTeam),
  };
}
