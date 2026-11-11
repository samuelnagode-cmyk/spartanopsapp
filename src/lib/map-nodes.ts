/**
 * Single source of truth for the points a marshal can place on the tactical map.
 * The five Domination sectors are hard-wired in the scanner, capture function and DB.
 */
export type MapNodeDef = {
  key: string;
  labelEn: string;
  labelSl: string;
  color: string;
  type: "capture" | "spawn" | "compass";
  /** For spawns: the team this spawn belongs to. */
  team?: "modra" | "rdeca" | "rumena";
};

export const MAP_NODES: MapNodeDef[] = [
  { key: "1", labelEn: "1·ALPHA", labelSl: "1·ALPHA", color: "#E0B04E", type: "capture" },
  { key: "2", labelEn: "2·BETA", labelSl: "2·BETA", color: "#E0B04E", type: "capture" },
  { key: "3", labelEn: "3·GAMMA", labelSl: "3·GAMMA", color: "#E0B04E", type: "capture" },
  { key: "4", labelEn: "4·DELTA", labelSl: "4·DELTA", color: "#E0B04E", type: "capture" },
  { key: "5", labelEn: "5·EPSILON", labelSl: "5·EPSILON", color: "#E0B04E", type: "capture" },
  { key: "spawn_rdeca", labelEn: "SPAWN RED", labelSl: "SPAWN RDEČA", color: "#c0392b", type: "spawn", team: "rdeca" },
  { key: "spawn_modra", labelEn: "SPAWN BLUE", labelSl: "SPAWN MODRA", color: "#2e86de", type: "spawn", team: "modra" },
  { key: "spawn_rumena", labelEn: "SPAWN YELLOW", labelSl: "SPAWN RUMENA", color: "#f1c40f", type: "spawn", team: "rumena" },
  { key: "compass", labelEn: "COMPASS", labelSl: "KOMPAS", color: "#7fd4ff", type: "compass" },
];

/** Team order used across the app; the first N teams play when teamCount = N. */
export const TEAM_ORDER = ["modra", "rdeca", "rumena"] as const;

/** Nodes to show for a given team count (spawns limited to the playing teams). */
export function mapNodesFor(teamCount?: number): MapNodeDef[] {
  if (teamCount == null) return MAP_NODES;
  const n = Math.max(2, Math.min(TEAM_ORDER.length, Number(teamCount) || 2));
  const teams = new Set<string>(TEAM_ORDER.slice(0, n));
  return MAP_NODES.filter((m) => m.type !== "spawn" || (m.team && teams.has(m.team)));
}

export type NodePositions = Record<string, { x: number; y: number } | null>;

/**
 * Move spawn markers only; teams never change. 2 teams swap, 3 teams rotate one
 * place clockwise on screen (y axis points down). Returns null when not possible.
 */
export function rotateSpawns(positions: NodePositions, teamCount: number): NodePositions | null {
  const n = Math.floor(Number(teamCount) || 0);
  if (n < 2) return null;
  const teams = TEAM_ORDER.slice(0, Math.min(n, TEAM_ORDER.length));
  const keys = teams.map((t) => `spawn_${t}`);
  const pts = keys.map((k) => positions[k]);
  if (pts.some((p) => !p)) return null;
  const next: NodePositions = { ...positions };
  if (keys.length === 2) {
    next[keys[0]] = { ...pts[1]! };
    next[keys[1]] = { ...pts[0]! };
    return next;
  }
  const [A, B, C] = pts as { x: number; y: number }[];
  const cross = (B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x);
  if (cross >= 0) {
    next.spawn_modra = { ...B }; next.spawn_rdeca = { ...C }; next.spawn_rumena = { ...A };
  } else {
    next.spawn_modra = { ...C }; next.spawn_rumena = { ...B }; next.spawn_rdeca = { ...A };
  }
  return next;
}
