export const SHARE_TEAM_COLORS: Record<string, string> = {
  modra: "#3b82f6", rdeca: "#ef4444", rumena: "#eab308",
};
export const SHARE_NEUTRAL_COLOR = "#ece3c4";
const SECTOR_NAMES = ["ALPHA", "BETA", "GAMMA", "DELTA", "EPSILON"];
type Position = { x: number; y: number };
export type ShareNode = Position & { n: number; name: string; color: string; team: string | null };
export type ShareSpawn = Position & { team: string; color: string };

export function shareNodes(
  positions: Record<string, Position | null> | null | undefined,
  holders: Record<string, string | null> | null | undefined,
): ShareNode[] {
  return [1, 2, 3, 4, 5].flatMap((n) => {
    const position = positions?.[String(n)];
    if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return [];
    const holder = holders?.[String(n)];
    const team = holder && SHARE_TEAM_COLORS[holder] ? holder : null;
    return [{ ...position, n, name: SECTOR_NAMES[n - 1], team, color: team ? SHARE_TEAM_COLORS[team] : SHARE_NEUTRAL_COLOR }];
  });
}

export function shareSpawns(positions: Record<string, Position | null> | null | undefined): ShareSpawn[] {
  return ["modra", "rdeca", "rumena"].flatMap((team) => {
    const position = positions?.[`spawn_${team}`];
    return position && Number.isFinite(position.x) && Number.isFinite(position.y)
      ? [{ ...position, team, color: SHARE_TEAM_COLORS[team] }] : [];
  });
}

export function rankInShareTeam(players: { id: string; assigned_team: string }[], id: string): { rankInTeam: number; teamSize: number } | undefined {
  const me = players.find((p) => p.id === id);
  if (!me || me.assigned_team === "none") return undefined;
  const team = players.filter((p) => p.assigned_team === me.assigned_team);
  return { rankInTeam: team.findIndex((p) => p.id === id) + 1, teamSize: team.length };
}