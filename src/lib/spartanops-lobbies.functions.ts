import { createServerFn } from "@tanstack/react-start";
import { hardDeleteLobbyById } from "./spartanops-lobbies.server";

/**
 * Marshal-managed lobbies live in `public.spartanops_lobbies` (server-role only).
 * Reads for the public join page go through the `spartanops_lobbies_public` view.
 * Passwords are bcrypt-hashed in the DB via the `spartanops_hash_password` RPC.
 */

export type LobbyDto = {
  id: string;
  fieldName: string;
  eventName: string | null;
  location: string;
  country: string | null;
  city: string | null;
  gamemode: "domination" | "search_destroy";
  mapUrl: string | null;
  matchDurationMinutes: number;
  countdownSeconds: number;
  pointTarget: number;
  nodePositions: Record<string, { x: number; y: number } | null>;
  settings: Record<string, any>;
  published: boolean;
  state: "pending" | "active" | "paused" | "ended";
  startedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function mapRow(r: any): LobbyDto {
  return {
    id: r.id,
    fieldName: r.field_name,
    eventName: r.event_name ?? null,
    location: r.location ?? "",
    country: r.country ?? null,
    city: r.city ?? null,
    gamemode: (r.gamemode as any) ?? "domination",
    mapUrl: r.map_url ?? null,
    matchDurationMinutes: r.match_duration_minutes ?? 30,
    countdownSeconds: r.countdown_seconds ?? 60,
    pointTarget: r.point_target ?? 50,
    nodePositions: (r.node_positions as any) ?? {},
    settings: (r.settings as any) ?? {},
    published: !!r.published,
    state: (r.state as any) ?? "pending",
    startedAt: r.started_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function missionNameFromSettings(settings: Record<string, any> | null | undefined): string | null {
  const missionName = settings?.missionName;
  return typeof missionName === "string" && missionName.trim() ? missionName.trim() : null;
}

function checkMaster(pw: string): boolean {
  const master = process.env.SPARTANOPS_MASTER_PASSWORD;
  if (!master) return false;
  if (typeof pw !== "string" || pw.length === 0 || pw.length > 200) return false;
  return pw === master;
}

async function clearRespawnLocks(supabaseAdmin: any, lobbyId: string) {
  const { data: rows } = await supabaseAdmin
    .from("spartanops_checkins")
    .select("id")
    .eq("field_id", lobbyId);
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

async function resetMissionRuntime(supabaseAdmin: any, lobbyId: string) {
  const { error } = await supabaseAdmin.rpc("spartanops_reset_match_runtime" as any, { p_field_id: lobbyId });
  await supabaseAdmin
    .from("spartanops_qr_anchors" as any)
    .delete()
    .eq("field_id", lobbyId);
  if (error) {
    const { error: capturesError } = await supabaseAdmin
      .from("spartanops_captures")
      .delete()
      .eq("field_id", lobbyId);
    if (capturesError) throw new Error(capturesError.message);
    await clearRespawnLocks(supabaseAdmin, lobbyId);
  }
}

async function clearMissionRuntimeForStart(supabaseAdmin: any, lobbyId: string) {
  const { error: capturesError } = await supabaseAdmin
    .from("spartanops_captures")
    .delete()
    .eq("field_id", lobbyId);
  if (capturesError) throw new Error(capturesError.message);
  await clearRespawnLocks(supabaseAdmin, lobbyId);
  await supabaseAdmin
    .from("spartanops_qr_anchors" as any)
    .delete()
    .eq("field_id", lobbyId);
}

/** Verify the master admin password (used by the admin console to unlock edit mode). */
export const verifyMasterPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { password: string }) => ({ password: String(d?.password ?? "") }))
  .handler(async ({ data }) => ({ ok: checkMaster(data.password) }));

/** List every published lobby (public, no auth required). */
export const listPublishedLobbies = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("spartanops_lobbies_public" as any)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
});

/** Full listing including unpublished — used by the admin panel. Requires the master password. */
export const listAllLobbies = createServerFn({ method: "POST" })
  .inputValidator((d: { masterPassword: string }) => ({ masterPassword: String(d?.masterPassword ?? "") }))
  .handler(async ({ data }) => {
    if (!checkMaster(data.masterPassword)) throw new Error("Unauthorized");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("spartanops_lobbies" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (rows ?? []).map(mapRow);
  });

/** Fetch a single lobby (admin/marshal view). Requires master or the lobby's marshal password. */
export const getLobby = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; authPassword: string }) => ({
    id: String(d?.id ?? ""),
    authPassword: String(d?.authPassword ?? ""),
  }))
  .handler(async ({ data }) => {
    if (!data.id) return null;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let authorized = checkMaster(data.authPassword);
    if (!authorized) {
      const { data: ok } = await supabaseAdmin.rpc("spartanops_verify_lobby_password" as any, {
        p_lobby_id: data.id,
        p_password: data.authPassword,
        p_kind: "marshal",
      });
      authorized = ok === true;
    }
    if (!authorized) throw new Error("Unauthorized");
    const { data: row } = await supabaseAdmin
      .from("spartanops_lobbies" as any)
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    return row ? mapRow(row) : null;
  });

type CreateInput = {
  fieldName: string;
  eventName?: string;
  location: string;
  country?: string;
  city?: string;
  gamemode: "domination" | "search_destroy";
  mapUrl?: string;
  matchDurationMinutes: number;
  countdownSeconds: number;
  pointTarget: number;
  nodePositions?: Record<string, { x: number; y: number } | null>;
  settings?: Record<string, any>;
  password: string;
  marshalPassword: string;
  published: boolean;
};

export const createLobby = createServerFn({ method: "POST" })
  .inputValidator((d: CreateInput & { masterPassword?: string }) => d)
  .handler(async ({ data }) => {
    // Any marshal can create their own lobby (they set their own passwords).
    // Master password is not required for lobby creation — only for admin edit/delete.
    if (!data.fieldName?.trim()) throw new Error("Field name required");
    if (!data.password || data.password.length < 3) throw new Error("Password required");
    if (!data.marshalPassword || data.marshalPassword.length < 3) throw new Error("Marshal password required");
    if (data.password === data.marshalPassword) throw new Error("Passwords must differ");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: pHash, error: e1 }, { data: mHash, error: e2 }] = await Promise.all([
      supabaseAdmin.rpc("spartanops_hash_password" as any, { p_password: data.password }),
      supabaseAdmin.rpc("spartanops_hash_password" as any, { p_password: data.marshalPassword }),
    ]);
    if (e1 || e2 || !pHash || !mHash) throw new Error("Failed to hash password");

    const row = {
      field_name: data.fieldName.trim(),
      event_name: data.eventName?.trim() || null,
      location: data.location || "",
      country: data.country?.trim() || null,
      city: data.city?.trim() || null,
      gamemode: data.gamemode,
      map_url: data.mapUrl?.trim() || null,
      match_duration_minutes: data.matchDurationMinutes,
      countdown_seconds: data.countdownSeconds,
      point_target: data.pointTarget,
      node_positions: data.nodePositions ?? {},
      settings: data.settings ?? {},
      password_hash: pHash as unknown as string,
      marshal_password_hash: mHash as unknown as string,
      published: data.published,
      state: "pending",
    };
    const { data: created, error } = await supabaseAdmin
      .from("spartanops_lobbies" as any)
      .insert(row)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return mapRow(created);
  });

type UpdatePatch = Partial<
  Omit<CreateInput, "password" | "marshalPassword">
> & {
  state?: "pending" | "active" | "paused" | "ended";
  startedAt?: string | null;
  password?: string;
  marshalPassword?: string;
};

export const updateLobbyServer = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; patch: UpdatePatch; authPassword: string }) => ({
    id: String(d?.id ?? ""),
    patch: d?.patch ?? {},
    authPassword: String(d?.authPassword ?? ""),
  }))
  .handler(async ({ data }) => {
    if (!data.id) throw new Error("id required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let authorized = checkMaster(data.authPassword);
    if (!authorized) {
      const { data: ok } = await supabaseAdmin.rpc("spartanops_verify_lobby_password" as any, {
        p_lobby_id: data.id,
        p_password: data.authPassword,
        p_kind: "marshal",
      });
      authorized = ok === true;
    }
    if (!authorized) throw new Error("Unauthorized");
    // supabaseAdmin already imported above
    const p = data.patch;
    const serverNowMs = Date.now();
    const serverNowIso = new Date(serverNowMs).toISOString();
    const startAfterSeconds = Number(p.countdownSeconds ?? 0);
    const serverStartedAt = p.state === "active"
      ? new Date(serverNowMs + Math.max(0, Number.isFinite(startAfterSeconds) ? startAfterSeconds : 0) * 1000).toISOString()
      : null;
    const row: Record<string, any> = { updated_at: serverNowIso };
    if (p.fieldName !== undefined) row.field_name = p.fieldName;
    if (p.eventName !== undefined) row.event_name = p.eventName || null;
    if (p.location !== undefined) row.location = p.location;
    if (p.country !== undefined) row.country = p.country || null;
    if (p.city !== undefined) row.city = p.city || null;
    if (p.gamemode !== undefined) row.gamemode = p.gamemode;
    if (p.mapUrl !== undefined) row.map_url = p.mapUrl || null;
    if (p.matchDurationMinutes !== undefined) row.match_duration_minutes = p.matchDurationMinutes;
    if (p.countdownSeconds !== undefined) row.countdown_seconds = p.countdownSeconds;
    if (p.pointTarget !== undefined) row.point_target = p.pointTarget;
    if (p.nodePositions !== undefined) row.node_positions = p.nodePositions;
    if (p.settings !== undefined) row.settings = p.settings;
    if (p.published !== undefined) row.published = p.published;
    if (p.state !== undefined) row.state = p.state;
    if (p.startedAt !== undefined) row.started_at = p.startedAt;
    if (serverStartedAt) row.started_at = serverStartedAt;

    if (p.password) {
      const { data: hash, error } = await supabaseAdmin.rpc("spartanops_hash_password" as any, { p_password: p.password });
      if (error || !hash) throw new Error("Failed to hash password");
      row.password_hash = hash as unknown as string;
    }
    if (p.marshalPassword) {
      const { data: hash, error } = await supabaseAdmin.rpc("spartanops_hash_password" as any, { p_password: p.marshalPassword });
      if (error || !hash) throw new Error("Failed to hash password");
      row.marshal_password_hash = hash as unknown as string;
    }

    // Mirror settings-relevant fields into the live game_state so player HUDs pick them up.
    const gsPatch: Record<string, any> = { updated_at: serverNowIso };
    const nextSettings = p.settings !== undefined ? p.settings : undefined;
    const missionName = missionNameFromSettings(nextSettings as any);
    if (p.fieldName !== undefined) {
      gsPatch.field_label = p.fieldName || data.id;
      gsPatch.current_polygon_name = p.fieldName || null;
    }
    if (p.matchDurationMinutes !== undefined) gsPatch.match_duration_minutes = p.matchDurationMinutes;
    if (p.countdownSeconds !== undefined) gsPatch.countdown_seconds = p.countdownSeconds;
    if (p.pointTarget !== undefined) gsPatch.point_target = p.pointTarget;
    if (p.gamemode !== undefined) gsPatch.gamemode = p.gamemode;
    if (p.eventName !== undefined || missionName) gsPatch.event_name = missionName || p.eventName || null;
    if (p.mapUrl !== undefined) gsPatch.compressed_map_url = p.mapUrl || null;
    if (p.settings !== undefined) gsPatch.settings = p.settings;
    if (p.nodePositions !== undefined) gsPatch.node_positions = p.nodePositions;
    if (p.state === "active") {
      await clearMissionRuntimeForStart(supabaseAdmin, data.id);
      gsPatch.status = "active";
      gsPatch.match_started_at = serverStartedAt ?? serverNowIso;
      gsPatch.team_scores = freshScores();
      gsPatch.node_holders = FREE_NODES;
      gsPatch.winner_team = null;
    } else if (p.state === "paused") {
      gsPatch.status = "paused";
    } else if (p.state === "ended") {
      gsPatch.status = "ended";
    } else if (p.state === "pending") {
      await resetMissionRuntime(supabaseAdmin, data.id);
      gsPatch.status = "lobby";
      gsPatch.match_started_at = null;
      gsPatch.team_scores = freshScores();
      gsPatch.node_holders = FREE_NODES;
      gsPatch.winner_team = null;
    }

    const { data: updated, error } = await supabaseAdmin
      .from("spartanops_lobbies" as any)
      .update(row)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (Object.keys(gsPatch).length > 1) {
      const { error: gsError } = await supabaseAdmin
        .from("spartanops_game_state" as any)
        .update(gsPatch)
        .eq("field_id", data.id);
      if (gsError) throw new Error(gsError.message);
    }

    return mapRow(updated);
  });

/** Verify a player's or marshal's password. */
export const verifyLobbyPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; password: string; kind: "player" | "marshal" }) => ({
    id: String(d?.id ?? ""),
    password: String(d?.password ?? ""),
    kind: d?.kind === "marshal" ? "marshal" : "player",
  }))
  .handler(async ({ data }) => {
    if (!data.id || !data.password) return { ok: false };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ok } = await supabaseAdmin.rpc("spartanops_verify_lobby_password" as any, {
      p_lobby_id: data.id,
      p_password: data.password,
      p_kind: data.kind,
    });
    return { ok: ok === true };
  });

/** Delete every player registered in this lobby (used by "delete all players" button). */
export const deleteLobbyPlayers = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; marshalPassword: string }) => ({
    id: String(d?.id ?? ""),
    marshalPassword: String(d?.marshalPassword ?? ""),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ok } = await supabaseAdmin.rpc("spartanops_verify_lobby_password" as any, {
      p_lobby_id: data.id,
      p_password: data.marshalPassword,
      p_kind: "marshal",
    });
    if (ok !== true) throw new Error("Unauthorized");
    const { error } = await supabaseAdmin.rpc("spartanops_delete_lobby_players" as any, { p_lobby_id: data.id });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Full decommission — deletes lobby + checkins + captures + game state. */
export const deleteLobbyServer = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; marshalPassword: string }) => ({
    id: String(d?.id ?? ""),
    marshalPassword: String(d?.marshalPassword ?? ""),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ok } = await supabaseAdmin.rpc("spartanops_verify_lobby_password" as any, {
      p_lobby_id: data.id,
      p_password: data.marshalPassword,
      p_kind: "marshal",
    });
    if (ok !== true) throw new Error("Unauthorized");
    await hardDeleteLobbyById(supabaseAdmin, data.id);
    return { ok: true };
  });

/** Master-admin override: fully decommission a lobby without the marshal password. */
export const masterDeleteLobby = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string; masterPassword: string }) => ({
    id: String(d?.id ?? ""),
    masterPassword: String(d?.masterPassword ?? ""),
  }))
  .handler(async ({ data }) => {
    if (!checkMaster(data.masterPassword)) throw new Error("Unauthorized");
    if (!data.id) throw new Error("id required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await hardDeleteLobbyById(supabaseAdmin, data.id);
    return { ok: true };
  });
