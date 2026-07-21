import { createServerFn } from "@tanstack/react-start";

const LEGACY_FIELDS = new Set(["zeleni-raj", "field-1", "field-2", "field-3"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isField(x: string): boolean {
  return LEGACY_FIELDS.has(x) || UUID_RE.test(x);
}

async function verifyMarshalAccess(fieldId: string, password: string): Promise<boolean> {
  if (!password || password.length > 200) return false;
  const master = process.env.SPARTANOPS_MASTER_PASSWORD;
  if (master && password === master) return true;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: legacyOk } = await supabaseAdmin.rpc("verify_field_password" as any, {
    p_field_id: fieldId,
    p_password: password,
  });
  if (legacyOk === true) return true;

  if (UUID_RE.test(fieldId)) {
    const { data: lobbyOk } = await supabaseAdmin.rpc("spartanops_verify_lobby_password" as any, {
      p_lobby_id: fieldId,
      p_password: password,
      p_kind: "marshal",
    });
    if (lobbyOk === true) return true;
  }

  return false;
}

const ANCHOR_RADIUS_M = 10;
// Keep the strict physical radius, but use the browser's raw reported accuracy
// as tolerance. iOS/Android can hand back approximate fixes hundreds of metres
// away; clamping that value before validation creates false Spartacus flags.
const MAX_ACCURACY_BUFFER_M = 1000;
const MAX_ACCEPTED_ACCURACY_M = 1200;

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/**
 * Spartacus-aware capture. Behaviour:
 *  - If no lat/lng supplied → returns { ok:false, error:'gps_required' }.
 *  - If no anchor exists yet for (field, point), the current scan anchors it and
 *    proceeds as a normal capture.
 *  - If an anchor exists and distance is inside the operational radius plus a
 *    bounded GPS accuracy buffer, proceeds as a normal capture.
 *  - If distance exceeds that threshold, inserts a *suspicious* capture row (spartacus_status='pending',
 *    suspicious=true) WITHOUT updating the live scoreboard/holders. Marshals then
 *    review it.
 */
export const spartanopsSpartacusCapture = createServerFn({ method: "POST" })
  .inputValidator((d: { fieldId: string; point: number; sessionId: string; lat?: number | null; lng?: number | null; accuracy?: number | null }) => ({
    fieldId: String(d?.fieldId ?? ""),
    point: Number(d?.point),
    sessionId: String(d?.sessionId ?? ""),
    lat: typeof d?.lat === "number" && isFinite(d.lat) ? d.lat : null,
    lng: typeof d?.lng === "number" && isFinite(d.lng) ? d.lng : null,
    accuracy: typeof d?.accuracy === "number" && isFinite(d.accuracy) ? Math.max(0, Math.min(MAX_ACCEPTED_ACCURACY_M, d.accuracy)) : 0,
  }))
  .handler(async ({ data }) => {
    if (!isField(data.fieldId)) throw new Error("Invalid field");
    if (![1, 2, 3, 4, 5].includes(data.point)) throw new Error("Invalid point");
    if (!data.sessionId || data.sessionId.length > 100) throw new Error("Invalid session");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: state } = await supabaseAdmin
      .from("spartanops_game_state")
      .select("field_id, status, match_started_at")
      .eq("field_id", data.fieldId)
      .maybeSingle();

    // Spartacus GPS anti-cheat is now ALWAYS enforced. No mission-settings bypass.
    if (data.lat == null || data.lng == null) {
      return { ok: false, error: "gps_required", spartacus: true } as const;
    }
    if ((data.accuracy ?? 9999) > MAX_ACCEPTED_ACCURACY_M) {
      return { ok: false, error: "gps_required", spartacus: true, low_accuracy: true } as const;
    }
    if (state?.status !== "active") return { ok: false, error: "match_not_active", spartacus: true } as const;
    const matchStart = (state as any)?.match_started_at ? Date.parse((state as any).match_started_at) : NaN;
    if (!Number.isFinite(matchStart) || matchStart > Date.now()) {
      return { ok: false, error: "pre_start_locked", spartacus: true } as const;
    }

    const { data: secret } = await supabaseAdmin
      .from("spartanops_checkin_secrets" as any)
      .select("checkin_id")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!secret) return { ok: false, error: "not_checked_in", spartacus: true } as const;
    const { data: checkin } = await supabaseAdmin
      .from("spartanops_checkins")
      .select("id, callsign, assigned_team")
      .eq("field_id", data.fieldId)
      .eq("id", (secret as any).checkin_id)
      .maybeSingle();
    if (!checkin) return { ok: false, error: "not_checked_in", spartacus: true } as const;
    if ((checkin as any).assigned_team === "none") return { ok: false, error: "no_team", spartacus: true } as const;

    const { data: anchor } = await supabaseAdmin
      .from("spartanops_qr_anchors")
      .select("latitude, longitude, anchor_accuracy_m")
      .eq("field_id", data.fieldId)
      .eq("point_number", data.point)
      .maybeSingle();

    if (!anchor) {
      await supabaseAdmin.from("spartanops_qr_anchors").insert({
        field_id: data.fieldId,
        point_number: data.point,
        latitude: data.lat,
        longitude: data.lng,
        anchor_accuracy_m: data.accuracy ?? null,
        anchored_by_callsign: (checkin as any).callsign,
      } as any);
      const { data: r, error } = await supabaseAdmin.rpc("spartanops_apply_capture" as any, {
        p_field_id: data.fieldId,
        p_point: data.point,
        p_session_id: data.sessionId,
      });
      if (error) throw new Error(error.message);
      // annotate the newest capture row with GPS
      await supabaseAdmin
        .from("spartanops_captures")
        .update({ latitude: data.lat, longitude: data.lng, distance_m: 0 } as any)
        .eq("field_id", data.fieldId)
        .eq("point_number", data.point)
        .eq("player_callsign", (checkin as any).callsign)
        .order("captured_at", { ascending: false })
        .limit(1);
      return { ...(r as any), spartacus: true, anchored: true };
    }

    const dist = haversineMeters(
      { lat: (anchor as any).latitude, lng: (anchor as any).longitude },
      { lat: data.lat, lng: data.lng },
    );

    // Allowed radius factors in BOTH the current scan's accuracy AND the
    // accuracy of the fix that originally anchored the point. Without the
    // anchor-side buffer, a legitimate second scan (e.g. enemy team recap at
    // the exact same spot) can drift past the threshold whenever the first
    // player's GPS was imprecise.
    const scanBuffer = Math.min(MAX_ACCURACY_BUFFER_M, data.accuracy ?? 0);
    const anchorAcc = typeof (anchor as any).anchor_accuracy_m === "number" ? (anchor as any).anchor_accuracy_m : 0;
    const anchorBuffer = Math.min(MAX_ACCURACY_BUFFER_M, anchorAcc);
    const allowedRadius = ANCHOR_RADIUS_M + scanBuffer + anchorBuffer;

    if (dist > allowedRadius) {
      await supabaseAdmin.from("spartanops_captures").insert({
        field_id: data.fieldId,
        point_number: data.point,
        team: (checkin as any).assigned_team,
        player_checkin_id: (checkin as any).id,
        player_callsign: (checkin as any).callsign,
        latitude: data.lat,
        longitude: data.lng,
        distance_m: dist,
        suspicious: true,
        spartacus_status: "pending",
      } as any);
      return { ok: false, suspicious: true, spartacus: true, error: "spartacus_flagged", distance_m: dist } as const;
    }

    const { data: r, error } = await supabaseAdmin.rpc("spartanops_apply_capture" as any, {
      p_field_id: data.fieldId,
      p_point: data.point,
      p_session_id: data.sessionId,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("spartanops_captures")
      .update({ latitude: data.lat, longitude: data.lng, distance_m: dist } as any)
      .eq("field_id", data.fieldId)
      .eq("point_number", data.point)
      .eq("player_callsign", (checkin as any).callsign)
      .order("captured_at", { ascending: false })
      .limit(1);
    return { ...(r as any), spartacus: true, distance_m: dist };
  });

/**
 * Marshal review of a suspicious Spartacus capture.
 *  - decision='approve': applies the capture to game_state (score + holder),
 *    marks the row spartacus_status='approved' and suspicious=false.
 *  - decision='reject': marks the row spartacus_status='rejected'; no score change.
 *  - decision='ban': rejects the row AND removes the player from the checkin table.
 */
export const spartanopsSpartacusReview = createServerFn({ method: "POST" })
  .inputValidator((d: { captureId: string; decision: "approve" | "reject" | "ban" | "suspend" | "warning"; fieldId: string; password: string; suspendMinutes?: number; warningMessage?: string }) => ({
    captureId: String(d?.captureId ?? ""),
    decision: d?.decision,
    fieldId: String(d?.fieldId ?? ""),
    password: String(d?.password ?? ""),
    suspendMinutes: Math.max(1, Math.min(60, Number(d?.suspendMinutes ?? 5))),
    warningMessage: typeof d?.warningMessage === "string" ? d.warningMessage.slice(0, 500) : "",
  }))
  .handler(async ({ data }) => {
    if (!isField(data.fieldId)) throw new Error("Invalid field");
    if (!["approve", "reject", "ban", "suspend", "warning"].includes(data.decision)) throw new Error("Invalid decision");
    if (!data.password || data.password.length > 200) throw new Error("Invalid password");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ok = await verifyMarshalAccess(data.fieldId, data.password);
    if (!ok) throw new Error("Unauthorized");

    const { data: cap } = await supabaseAdmin
      .from("spartanops_captures")
      .select("id, field_id, point_number, team, player_checkin_id, player_callsign")
      .eq("id", data.captureId)
      .maybeSingle();
    if (!cap) throw new Error("Capture not found");

    if (data.decision === "approve") {
      const { data: state } = await supabaseAdmin
        .from("spartanops_game_state")
        .select("field_id, status, team_scores, node_holders, point_target, winner_team")
        .eq("field_id", (cap as any).field_id)
        .maybeSingle();
      if (state) {
        const scores = { ...(((state as any).team_scores as Record<string, number>) ?? {}) };
        const holders = { ...(((state as any).node_holders as Record<string, string | null>) ?? {}) };
        const team = (cap as any).team as string;
        const p = String((cap as any).point_number);
        if (holders[p] !== team) {
          holders[p] = team;
          scores[team] = (scores[team] ?? 0) + 1;
        }
        const target = (state as any).point_target ?? 50;
        let winner = (state as any).winner_team ?? null;
        let status = (state as any).status ?? "active";
        if ((scores[team] ?? 0) >= target) {
          winner = team;
          status = "ended";
        }
        await supabaseAdmin
          .from("spartanops_game_state")
          .update({ team_scores: scores, node_holders: holders, winner_team: winner, status, updated_at: new Date().toISOString() } as any)
          .eq("field_id", (cap as any).field_id);
      }
      await supabaseAdmin
        .from("spartanops_captures")
        .update({ suspicious: false, spartacus_status: "approved" } as any)
        .eq("id", data.captureId);
    } else {
      await supabaseAdmin
        .from("spartanops_captures")
        .update({ spartacus_status: "rejected" } as any)
        .eq("id", data.captureId);

      if (data.decision === "warning" && (cap as any).player_checkin_id) {
        await supabaseAdmin
          .from("spartanops_checkins")
          .update({ warning_message: data.warningMessage || "warning" } as any)
          .eq("id", (cap as any).player_checkin_id);
      }

      if (data.decision === "suspend" && (cap as any).player_checkin_id) {
        const until = new Date(Date.now() + data.suspendMinutes * 60_000).toISOString();
        await supabaseAdmin
          .from("spartanops_checkin_secrets" as any)
          .update({ respawn_unlock_at: until, updated_at: new Date().toISOString() } as any)
          .eq("checkin_id", (cap as any).player_checkin_id);
      }

      if (data.decision === "ban" && (cap as any).player_checkin_id) {
        await supabaseAdmin
          .from("spartanops_checkins")
          .delete()
          .eq("id", (cap as any).player_checkin_id);
      }
    }
    return { ok: true as const };
  });

/**
 * Player-side: clear the warning_message for the caller's own checkin so the
 * dedicated warning modal on the Game HUD can be dismissed.
 */
export const spartanopsAcknowledgeWarning = createServerFn({ method: "POST" })
  .inputValidator((d: { fieldId: string; sessionId: string }) => ({
    fieldId: String(d?.fieldId ?? ""),
    sessionId: String(d?.sessionId ?? ""),
  }))
  .handler(async ({ data }) => {
    if (!isField(data.fieldId)) throw new Error("Invalid field");
    if (!data.sessionId || data.sessionId.length > 100) throw new Error("Invalid session");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: secret } = await supabaseAdmin
      .from("spartanops_checkin_secrets" as any)
      .select("checkin_id")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!secret) return { ok: true as const };
    await supabaseAdmin
      .from("spartanops_checkins")
      .update({ warning_message: null } as any)
      .eq("id", (secret as any).checkin_id)
      .eq("field_id", data.fieldId);
    return { ok: true as const };
  });

/**
 * Marshal-only: list pending suspicious captures for a field. Marshal password
 * is verified server-side; the RPC is no longer callable from anon/authenticated.
 */
export const spartanopsListSuspiciousCaptures = createServerFn({ method: "POST" })
  .inputValidator((d: { fieldId: string; password: string }) => ({
    fieldId: String(d?.fieldId ?? ""),
    password: String(d?.password ?? ""),
  }))
  .handler(async ({ data }) => {
    if (!isField(data.fieldId)) throw new Error("Invalid field");
    if (!data.password || data.password.length > 200) throw new Error("Invalid password");
    const ok = await verifyMarshalAccess(data.fieldId, data.password);
    if (!ok) throw new Error("Unauthorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("spartanops_captures")
      .select("id, point_number, team, player_callsign, latitude, longitude, distance_m, captured_at, spartacus_status")
      .eq("field_id", data.fieldId)
      .eq("suspicious", true)
      .eq("spartacus_status", "pending")
      .order("captured_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return { ok: true as const, rows: (rows ?? []) as any[] };
  });

