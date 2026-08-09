import { createServerFn } from "@tanstack/react-start";

type FieldId = string;

type Patch = {
  status?: "closed" | "lobby" | "active" | "paused" | "ended";
  team_selection_open?: boolean;
  current_polygon_name?: string | null;
  compressed_map_url?: string | null;
  countdown_seconds?: number;
  match_duration_minutes?: number;
  match_started_at?: string | null;
  team_scores?: Record<string, number>;
  node_holders?: Record<string, string | null>;
  node_positions?: Record<string, { x: number; y: number } | null>;
  point_target?: number;
  winner_team?: string | null;
  start_after_seconds?: number;
};

// Accepts the fixed legacy ids AND any UUID belonging to a dynamic lobby.
const LEGACY_FIELDS = new Set(["zeleni-raj", "field-1", "field-2", "field-3"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isField(x: string): x is FieldId {
  return LEGACY_FIELDS.has(x) || UUID_RE.test(x);
}


/**
 * Validate a tab password against the bcrypt hash stored in
 * public.spartanops_field_secrets via a security-definer DB function.
 * Throws on failure so handlers can rely on a boolean ok-path.
 */
async function verifyFieldPassword(tab: string, password: string): Promise<boolean> {
  if (typeof password !== "string" || password.length === 0 || password.length > 200) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1) Master password bypass (marshal admin override).
  const master = process.env.SPARTANOPS_MASTER_PASSWORD;
  if (master && password === master) return true;

  // 2) Legacy field secret (fixed-id fields with rows in spartanops_field_secrets).
  const { data: legacyOk } = await supabaseAdmin.rpc("verify_field_password" as any, {
    p_field_id: tab,
    p_password: password,
  });
  if (legacyOk === true) return true;

  // 3) Dynamic lobby marshal password (UUID-keyed lobbies).
  if (UUID_RE.test(tab)) {
    const { data: lobbyOk } = await supabaseAdmin.rpc("spartanops_verify_lobby_password" as any, {
      p_lobby_id: tab,
      p_password: password,
      p_kind: "marshal",
    });
    if (lobbyOk === true) return true;
  }
  return false;
}

async function requireFieldPassword(tab: string, password: string) {
  const ok = await verifyFieldPassword(tab, password);
  if (!ok) throw new Error("Unauthorized");
}

async function clearRespawnLocks(supabaseAdmin: any, fieldId: string) {
  const { data: rows } = await supabaseAdmin
    .from("spartanops_checkins")
    .select("id")
    .eq("field_id", fieldId);
  const ids = (rows ?? []).map((r: any) => r.id).filter(Boolean);
  if (ids.length === 0) return;
  await supabaseAdmin
    .from("spartanops_checkin_secrets" as any)
    .update({ respawn_unlock_at: null, updated_at: new Date().toISOString() } as any)
    .in("checkin_id", ids);
}

function freshScores(teamScores?: Record<string, number>) {
  const teams = Object.keys(teamScores ?? { modra: 0, rdeca: 0, rumena: 0 });
  return Object.fromEntries((teams.length ? teams : ["modra", "rdeca", "rumena"]).map((team) => [team, 0]));
}

const FREE_NODES = { "1": null, "2": null, "3": null, "4": null, "5": null };

async function resetMissionRuntime(supabaseAdmin: any, fieldId: string) {
  const { error } = await supabaseAdmin.rpc("spartanops_reset_match_runtime" as any, { p_field_id: fieldId });
  await supabaseAdmin
    .from("spartanops_qr_anchors" as any)
    .delete()
    .eq("field_id", fieldId);
  if (error) {
    const { error: capturesError } = await supabaseAdmin
      .from("spartanops_captures")
      .delete()
      .eq("field_id", fieldId);
    if (capturesError) throw new Error(capturesError.message);
    await clearRespawnLocks(supabaseAdmin, fieldId);
  }
}

async function clearMissionRuntimeForStart(supabaseAdmin: any, fieldId: string) {
  const { error: capturesError } = await supabaseAdmin
    .from("spartanops_captures")
    .delete()
    .eq("field_id", fieldId);
  if (capturesError) throw new Error(capturesError.message);
  await clearRespawnLocks(supabaseAdmin, fieldId);
  await supabaseAdmin
    .from("spartanops_qr_anchors" as any)
    .delete()
    .eq("field_id", fieldId);
}

export const spartanopsAdminVerify = createServerFn({ method: "POST" })
  .inputValidator((d: { tab: string; password: string }) => ({
    tab: String(d?.tab ?? ""),
    password: String(d?.password ?? ""),
  }))
  .handler(async ({ data }) => {
    const ok = await verifyFieldPassword(data.tab, data.password);
    return { ok };
  });

export const spartanopsAdminPatchState = createServerFn({ method: "POST" })
  .inputValidator((d: { fieldId: string; password: string; patch: Patch }) => ({
    fieldId: String(d?.fieldId ?? ""),
    password: String(d?.password ?? ""),
    patch: d?.patch ?? {},
  }))
  .handler(async ({ data }) => {
    if (!isField(data.fieldId)) throw new Error("Invalid field");
    await requireFieldPassword(data.fieldId, data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const serverNowMs = Date.now();
    const serverNowIso = new Date(serverNowMs).toISOString();
    const { start_after_seconds: startAfterSeconds, ...rawPatch } = data.patch;
    const patch: Record<string, any> = { ...rawPatch };
    const isFreshStart = data.patch.status === "active" && typeof startAfterSeconds === "number" && Number.isFinite(startAfterSeconds);
    if (isFreshStart) {
      patch.match_started_at = new Date(serverNowMs + Math.max(0, startAfterSeconds) * 1000).toISOString();
      patch.team_scores = freshScores(patch.team_scores);
      patch.node_holders = FREE_NODES;
      patch.winner_team = null;
    }
    if (data.patch.status === "closed" || data.patch.status === "lobby" || data.patch.status === "ended") {
      // End / Reset must return every sector to neutral and zero the scores.
      // Node positions (the coordinates on the map) are untouched — only the
      // holder (which faction owns each sector) resets, so a new match starts
      // with the same layout but no captured points.
      await resetMissionRuntime(supabaseAdmin, data.fieldId);
      patch.match_started_at = null;
      patch.team_scores = freshScores(patch.team_scores);
      patch.node_holders = FREE_NODES;
      // Preserve an incoming winner_team only when the caller ended the
      // match (so debrief can announce it). Closed/lobby always clear it.
      if (data.patch.status !== "ended" || !("winner_team" in data.patch)) {
        patch.winner_team = data.patch.status === "ended" ? (data.patch.winner_team ?? null) : null;
      }
    }

    const { error } = await supabaseAdmin
      .from("spartanops_game_state")
      .update({ ...patch, updated_at: serverNowIso } as any)
      .eq("field_id", data.fieldId);
    if (error) throw new Error(error.message);
    // Cleanup follows the state broadcast so player clients never remain in
    // lobby while the Marshal is already displaying the pre-start countdown.
    if (isFreshStart) await clearMissionRuntimeForStart(supabaseAdmin, data.fieldId);
    if ("compressed_map_url" in patch) {
      await supabaseAdmin
        .from("spartanops_lobbies" as any)
        .update({ map_url: patch.compressed_map_url || null, updated_at: serverNowIso } as any)
        .eq("id", data.fieldId);
    }
    if ("node_positions" in patch) {
      await supabaseAdmin
        .from("spartanops_lobbies" as any)
        .update({ node_positions: patch.node_positions ?? {}, updated_at: serverNowIso } as any)
        .eq("id", data.fieldId);
    }
    return { ok: true };
  });

export const spartanopsAdminReassignTeam = createServerFn({ method: "POST" })
  .inputValidator((d: { fieldId: string; password: string; checkinId: string; team: "modra" | "rdeca" | "rumena" | "none" }) => ({
    fieldId: String(d?.fieldId ?? ""),
    password: String(d?.password ?? ""),
    checkinId: String(d?.checkinId ?? ""),
    team: d?.team,
  }))
  .handler(async ({ data }) => {
    if (!isField(data.fieldId)) throw new Error("Invalid field");
    await requireFieldPassword(data.fieldId, data.password);
    if (!["modra", "rdeca", "rumena", "none"].includes(data.team)) throw new Error("Invalid team");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("spartanops_checkins")
      .update({ assigned_team: data.team, team_changed_flag: true } as any)
      .eq("id", data.checkinId)
      .eq("field_id", data.fieldId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const spartanopsAdminRemovePlayer = createServerFn({ method: "POST" })
  .inputValidator((d: { fieldId: string; password: string; checkinId: string }) => ({
    fieldId: String(d?.fieldId ?? ""),
    password: String(d?.password ?? ""),
    checkinId: String(d?.checkinId ?? ""),
  }))
  .handler(async ({ data }) => {
    if (!isField(data.fieldId)) throw new Error("Invalid field");
    await requireFieldPassword(data.fieldId, data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("spartanops_checkins")
      .delete()
      .eq("id", data.checkinId)
      .eq("field_id", data.fieldId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const spartanopsAdminReset = createServerFn({ method: "POST" })
  .inputValidator((d: { fieldId: string; password: string }) => ({
    fieldId: String(d?.fieldId ?? ""),
    password: String(d?.password ?? ""),
  }))
  .handler(async ({ data }) => {
    if (!isField(data.fieldId)) throw new Error("Invalid field");
    await requireFieldPassword(data.fieldId, data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await resetMissionRuntime(supabaseAdmin, data.fieldId);
    await supabaseAdmin.from("spartanops_checkins").delete().eq("field_id", data.fieldId);
    await supabaseAdmin
      .from("spartanops_game_state")
      .update({
        status: "closed",
        team_selection_open: false,
        match_started_at: null,
        team_scores: freshScores(),
        node_holders: FREE_NODES,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("field_id", data.fieldId);
    return { ok: true };
  });

export const spartanopsAdminRemoveAllPlayers = createServerFn({ method: "POST" })
  .inputValidator((d: { fieldId: string; password: string }) => ({
    fieldId: String(d?.fieldId ?? ""),
    password: String(d?.password ?? ""),
  }))
  .handler(async ({ data }) => {
    if (!isField(data.fieldId)) throw new Error("Invalid field");
    await requireFieldPassword(data.fieldId, data.password);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Scoped strictly to this field/lobby — other fields are unaffected.
    await resetMissionRuntime(supabaseAdmin, data.fieldId);
    const { error } = await supabaseAdmin
      .from("spartanops_checkins")
      .delete()
      .eq("field_id", data.fieldId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const spartanopsAdminUploadMap = createServerFn({ method: "POST" })
  .inputValidator((d: { fieldId: string; password: string; filename: string; contentType: string; base64: string }) => ({
    fieldId: String(d?.fieldId ?? ""),
    password: String(d?.password ?? ""),
    filename: String(d?.filename ?? "map.webp"),
    contentType: String(d?.contentType ?? "image/webp"),
    base64: String(d?.base64 ?? ""),
  }))
  .handler(async ({ data }) => {
    if (!isField(data.fieldId)) throw new Error("Invalid field");
    await requireFieldPassword(data.fieldId, data.password);
    if (!/^image\/(webp|png|jpeg|jpg)$/i.test(data.contentType)) {
      throw new Error("Only WebP, PNG, or JPEG allowed");
    }
    const bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("File too large (>8MB)");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safe = data.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);
    const key = `maps/${data.fieldId}/${Date.now()}-${safe}`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("spartanops-maps")
      .upload(key, bytes, { contentType: data.contentType, upsert: false });
    if (upErr) throw new Error(upErr.message);

    const { data: signed, error: signErr } = await supabaseAdmin.storage
      .from("spartanops-maps")
      .createSignedUrl(key, 60 * 60 * 24 * 365);
    if (signErr || !signed) throw new Error(signErr?.message ?? "Sign failed");

    await supabaseAdmin
      .from("spartanops_game_state")
      .update({ compressed_map_url: signed.signedUrl, updated_at: new Date().toISOString() } as any)
      .eq("field_id", data.fieldId);
    await supabaseAdmin
      .from("spartanops_lobbies" as any)
      .update({ map_url: signed.signedUrl, updated_at: new Date().toISOString() } as any)
      .eq("id", data.fieldId);

    return { ok: true, url: signed.signedUrl };
  });
