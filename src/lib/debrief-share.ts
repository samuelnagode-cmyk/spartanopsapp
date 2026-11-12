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

export type ShareCrop = { x: number; y: number; w: number; h: number };
const FULL_IMAGE: ShareCrop = { x: 0, y: 0, w: 100, h: 100 };
const CROP_PAD_RATIO = 0.15;
const CROP_MIN_PAD = 6;

/** Bounding box of the given map points in percent of the image (0-100), padded so no marker is clipped. */
export function shareMapCrop(points: { x: number; y: number }[]): ShareCrop {
  if (!Array.isArray(points) || points.length < 2) return { ...FULL_IMAGE };
  for (const point of points) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return { ...FULL_IMAGE };
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const padX = Math.max(CROP_MIN_PAD, (maxX - minX) * CROP_PAD_RATIO);
  const padY = Math.max(CROP_MIN_PAD, (maxY - minY) * CROP_PAD_RATIO);
  const x = Math.max(0, minX - padX);
  const y = Math.max(0, minY - padY);
  const w = Math.min(100, maxX + padX) - x;
  const h = Math.min(100, maxY + padY) - y;
  if (!(w > 0) || !(h > 0)) return { ...FULL_IMAGE };
  return { x, y, w, h };
}

export function rankInShareTeam(players: { id: string; assigned_team: string }[], id: string): { rankInTeam: number; teamSize: number } | undefined {
  const me = players.find((p) => p.id === id);
  if (!me || me.assigned_team === "none") return undefined;
  const team = players.filter((p) => p.assigned_team === me.assigned_team);
  return { rankInTeam: team.findIndex((p) => p.id === id) + 1, teamSize: team.length };
}