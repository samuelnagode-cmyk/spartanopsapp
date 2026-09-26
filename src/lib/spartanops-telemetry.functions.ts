import { createServerFn } from "@tanstack/react-start";

export type OperationalTelemetry = {
  operators: number;
  scans: number;
  respawns: number;
  missions: number;
};

export type TelemetryKind = "qr_entry" | "respawn" | "mission_complete";

// Modest baseline values reflecting the initial deployment phase.
const BASE = { operators: 24, scans: 125, respawns: 115, missions: 3 } as const;

const KINDS = new Set<TelemetryKind>(["qr_entry", "respawn", "mission_complete"]);

/**
 * Increment a marketing telemetry counter. `dedupeKey` (optional) makes the
 * bump idempotent — used for mission completions so every player's device
 * reporting the debriefing screen only counts the mission once.
 */
export const bumpTelemetry = createServerFn({ method: "POST" })
  .inputValidator((input: { kind: TelemetryKind; dedupeKey?: string }) => input)
  .handler(async ({ data }) => {
    if (!KINDS.has(data.kind)) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row: Record<string, unknown> = { kind: data.kind };
    if (data.dedupeKey) row["dedupe_key"] = `${data.kind}:${data.dedupeKey}`.slice(0, 200);
    const { error } = await supabaseAdmin.from("spartanops_telemetry_events" as any).insert(row as any);
    // Duplicate dedupe key => already counted; treat as success.
    return { ok: !error || error.code === "23505" };
  });

const countKind = async (admin: any, kind: TelemetryKind): Promise<number> => {
  const { count } = await admin
    .from("spartanops_telemetry_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind);
  return count ?? 0;
};

export const getOperationalTelemetry = createServerFn({ method: "GET" }).handler(async (): Promise<OperationalTelemetry> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const [archivedRes, checkinsRes, capturesRes, qrEntries, respawnEvents] = await Promise.all([
    supabaseAdmin
      .from("spartanops_archived_missions" as any)
      .select("player_count,capture_count")
      .eq("mission_state", "ended"),
    supabaseAdmin
      .from("spartanops_checkins")
      .select("id", { count: "exact", head: true }),
    supabaseAdmin
      .from("spartanops_captures")
      .select("id", { count: "exact", head: true }),
    countKind(supabaseAdmin as any, "qr_entry"),
    countKind(supabaseAdmin as any, "respawn"),
  ]);

  const archived = (archivedRes.data as Array<{ player_count: number | null; capture_count: number | null }> | null) ?? [];
  const archivedPlayers = archived.reduce((s, r) => s + (Number(r.player_count) || 0), 0);
  const archivedCaptures = archived.reduce((s, r) => s + (Number(r.capture_count) || 0), 0);

  const liveCheckins = checkinsRes.count ?? 0;
  const liveCaptures = capturesRes.count ?? 0;

  return {
    // Every registered player: live rosters + players from missions that
    // actually reached "ended" before their lobby was deleted (excludes
    // test/aborted lobbies).
    operators: BASE.operators + archivedPlayers + liveCheckins,
    // Every accepted sector capture, counted once from the capture rows
    // themselves (live + archived from ended missions), plus distinct
    // respawn/lobby-join QR scans. Sector captures no longer also fire a
    // qr_entry event (see the capture.tsx fix), so this is no longer
    // double-counted.
    scans: BASE.scans + archivedCaptures + liveCaptures + qrEntries,
    // Respawn QR codes processed during live matches.
    respawns: BASE.respawns + respawnEvents,
    // Missions that actually reached "ended" status, counted once from the
    // archive (each lobby archives at most once, via an upsert on lobby_id).
    // Not added to the separate mission_complete event count, which would
    // double-count the same finished match once its lobby is later deleted.
    missions: BASE.missions + archived.length,
  };
});
