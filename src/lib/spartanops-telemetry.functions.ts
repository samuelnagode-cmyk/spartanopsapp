import { createServerFn } from "@tanstack/react-start";

export type OperationalTelemetry = {
  operators: number;
  scans: number;
  respawns: number;
  missions: number;
};

// Modest baseline values reflecting the initial deployment phase.
const BASE = { operators: 24, scans: 125, respawns: 115, missions: 3 } as const;

// A respawn is considered "live" (still in flight) when its unlock timestamp
// is in the future or within the last few minutes.
const RESPAWN_LOOKBACK_MS = 5 * 60 * 1000;

export const getOperationalTelemetry = createServerFn({ method: "GET" }).handler(async (): Promise<OperationalTelemetry> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [archivedRes, checkinsRes, capturesRes, respawnsRes] = await Promise.all([
    supabaseAdmin
      .from("spartanops_archived_missions" as any)
      .select("player_count,capture_count"),
    supabaseAdmin
      .from("spartanops_checkins")
      .select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("spartanops_captures")
      .select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("spartanops_checkin_secrets" as any)
      .select("respawn_unlock_at")
      .not("respawn_unlock_at", "is", null),
  ]);

  const archived = (archivedRes.data as Array<{ player_count: number | null; capture_count: number | null }> | null) ?? [];
  const archivedPlayers = archived.reduce((s, r) => s + (Number(r.player_count) || 0), 0);
  const archivedCaptures = archived.reduce((s, r) => s + (Number(r.capture_count) || 0), 0);

  const liveCheckins = checkinsRes.count ?? 0;
  const liveCaptures = capturesRes.count ?? 0;

  const now = Date.now();
  const respawnRows = (respawnsRes.data as Array<{ respawn_unlock_at: string | null }> | null) ?? [];
  const liveRespawns = respawnRows.filter((r) => {
    if (!r.respawn_unlock_at) return false;
    const t = Date.parse(r.respawn_unlock_at);
    return Number.isFinite(t) && t >= now - RESPAWN_LOOKBACK_MS;
  }).length;

  return {
    operators: BASE.operators + archivedPlayers + liveCheckins,
    scans: BASE.scans + archivedCaptures + liveCaptures,
    respawns: BASE.respawns + liveRespawns,
    missions: BASE.missions + archived.length,
  };
});
