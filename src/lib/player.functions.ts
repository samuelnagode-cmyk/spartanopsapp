import { createServerFn } from "@tanstack/react-start";
import { PRIVACY_VERSION, validatePlayer, type PlayerInput } from "./player-validation";
import { requireUser, isMarshal } from "./player-auth.server";
import { exportRsvpsFor } from "./event-rsvps.functions";

type TokenIn = { accessToken: string };
const tokenOnly = (d: unknown): TokenIn => ({ accessToken: String((d as TokenIn)?.accessToken ?? "") });

const COLS = "nickname, first_name, last_name, show_full_last_name, age_group, phone, club, experience_level, operator_type, primary_weapon, secondary_weapon, sidearm, gear_notes, link_games, privacy_version, privacy_accepted_at, created_at, updated_at";

const GAME_COLS = "mission_name, gamemode, ended_at, callsign, team, team_won, captures, deaths, is_mvp, end_reason";

/** Same key as the ledger SQL: encode(digest(session_id,'sha256'),'hex'). */
export async function playerKeyFor(sessionId: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(sessionId));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

type Admin = Awaited<ReturnType<typeof admin>>;
async function unlinkGames(db: Admin, userId: string): Promise<number> {
  const { data } = await db.from("spartanops_match_results").update({ player_user_id: null })
    .eq("player_user_id", userId).select("id");
  await db.from("spartanops_checkin_secrets").update({ user_id: null }).eq("user_id", userId);
  return data?.length ?? 0;
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export const playerGetMine = createServerFn({ method: "POST" })
  .inputValidator(tokenOnly)
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    const db = await admin();
    const [{ data: profile }, marshal] = await Promise.all([
      db.from("spartanops_players").select(COLS).eq("user_id", user.id).maybeSingle(),
      isMarshal(user.id),
    ]);
    return {
      profile: profile ?? null,
      privacyVersion: PRIVACY_VERSION,
      needsReconsent: !!profile && profile.privacy_version !== PRIVACY_VERSION,
      isMarshal: marshal,
    };
  });

export const playerSaveMine = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { accessToken?: unknown; profile?: unknown; privacyAccepted?: unknown };
    return { accessToken: String(o.accessToken ?? ""), profile: (o.profile ?? {}) as PlayerInput, privacyAccepted: o.privacyAccepted === true };
  })
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    const v = validatePlayer(data.profile);
    if (!v.ok) throw new Error(v.error);
    const db = await admin();
    const { data: existing } = await db.from("spartanops_players").select("privacy_version, link_games").eq("user_id", user.id).maybeSingle();
    const needsConsent = !existing || existing.privacy_version !== PRIVACY_VERSION;
    if (needsConsent && !data.privacyAccepted) throw new Error("validation:privacy");
    const now = new Date().toISOString();
    const raw = (data.profile as { link_games?: unknown }).link_games;
    const linkGames = typeof raw === "boolean" ? raw : (existing as { link_games?: boolean } | null)?.link_games ?? true;
    const row = {
      user_id: user.id,
      ...v.data,
      link_games: linkGames,
      updated_at: now,
      ...(needsConsent ? { privacy_version: PRIVACY_VERSION, privacy_accepted_at: now } : {}),
    };
    const { data: saved, error } = await db
      .from("spartanops_players")
      .upsert(row as never, { onConflict: "user_id" })
      .select(COLS)
      .single();
    if (error) { console.error("[playerSaveMine]", error.code); throw new Error("save_failed"); }
    if (existing?.link_games && !linkGames) {
      await db.from("spartanops_checkin_secrets").update({ user_id: null }).eq("user_id", user.id);
    }
    return { profile: saved };
  });

export const playerExportMine = createServerFn({ method: "POST" })
  .inputValidator(tokenOnly)
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    const db = await admin();
    const { data: profile } = await db.from("spartanops_players").select(COLS).eq("user_id", user.id).maybeSingle();
    const event_answers = await exportRsvpsFor(user.id);
    const { data: games } = await db.from("spartanops_match_results").select(GAME_COLS)
      .eq("player_user_id", user.id).order("ended_at", { ascending: false });
    return { exported_at: new Date().toISOString(), account: { email: user.email }, profile: profile ?? null, event_answers, games: games ?? [] };
  });

export const playerDeleteMine = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { accessToken?: unknown; confirm?: unknown };
    return { accessToken: String(o.accessToken ?? ""), confirm: String(o.confirm ?? "") };
  })
  .handler(async ({ data }) => {
    if (data.confirm !== "DELETE") throw new Error("confirm_required");
    const user = await requireUser(data.accessToken);
    const db = await admin();
    await unlinkGames(db, user.id);
    const { error } = await db.from("spartanops_players").delete().eq("user_id", user.id);
    if (error) throw new Error("delete_failed");
    if (await isMarshal(user.id)) return { keptLogin: true };
    const { error: delErr } = await db.auth.admin.deleteUser(user.id);
    if (delErr) throw new Error("delete_failed");
    return { keptLogin: false };
  });

export const playerGamesMine = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { accessToken?: unknown; limit?: unknown };
    const n = Number(o.limit ?? 50);
    return { accessToken: String(o.accessToken ?? ""), limit: Math.min(200, Math.max(1, Number.isFinite(n) ? Math.floor(n) : 50)) };
  })
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    const db = await admin();
    const [{ data: rows }, { data: tot }] = await Promise.all([
      db.from("spartanops_match_results").select(`${GAME_COLS}, account_id`)
        .eq("player_user_id", user.id).order("ended_at", { ascending: false }).limit(data.limit),
      db.rpc("spartanops_player_game_totals", { p_user: user.id }),
    ]);
    const ids = [...new Set((rows ?? []).map((r) => r.account_id))];
    const names = new Map<string, string>();
    if (ids.length) {
      const { data: accs } = await db.from("spartanops_accounts").select("id, business_name").in("id", ids);
      for (const a of accs ?? []) names.set(a.id, a.business_name);
    }
    const t = (Array.isArray(tot) ? tot[0] : tot) ?? { games: 0, wins: 0, captures: 0, deaths: 0, mvps: 0 };
    return {
      totals: { games: t.games, wins: t.wins, captures: t.captures, deaths: t.deaths, mvps: t.mvps },
      games: (rows ?? []).map(({ account_id, ...r }) => ({ ...r, field_name: names.get(account_id) ?? r.mission_name })),
    };
  });

const lastClaim = new Map<string, number>();
export const playerClaimDevice = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { accessToken?: unknown; sessionId?: unknown };
    const sessionId = String(o.sessionId ?? "");
    if (sessionId.length < 8 || sessionId.length > 100) throw new Error("invalid_session");
    return { accessToken: String(o.accessToken ?? ""), sessionId };
  })
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    const now = Date.now();
    if (now - (lastClaim.get(user.id) ?? 0) < 10_000) throw new Error("rate_limited");
    lastClaim.set(user.id, now);
    const db = await admin();
    const { data: p } = await db.from("spartanops_players").select("link_games").eq("user_id", user.id).maybeSingle();
    if (!p) throw new Error("profile_required");
    if (!p.link_games) throw new Error("link_games_off");
    const key = await playerKeyFor(data.sessionId);
    const { data: rows } = await db.from("spartanops_match_results").update({ player_user_id: user.id })
      .eq("player_key", key).is("player_user_id", null).select("id");
    await db.from("spartanops_checkin_secrets").update({ user_id: user.id })
      .eq("session_id", data.sessionId).is("user_id", null);
    return { claimed: rows?.length ?? 0 };
  });

export const playerCheckinDefaults = createServerFn({ method: "POST" })
  .inputValidator(tokenOnly)
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    const db = await admin();
    const { data: p } = await db.from("spartanops_players")
      .select("nickname, first_name, last_name, age_group, phone, club, experience_level, operator_type, link_games")
      .eq("user_id", user.id).maybeSingle();
    if (!p) return { profile: false as const };
    const adult = p.age_group === "18_plus";
    return {
      profile: true as const,
      callsign: p.nickname, firstName: p.first_name,
      lastInitial: adult && p.last_name ? p.last_name.charAt(0).toUpperCase() : null,
      club: p.club, experienceLevel: p.experience_level, operatorType: p.operator_type,
      adult, hasPhone: adult && !!p.phone, linkGames: p.link_games,
    };
  });

export const playerGamesForget = createServerFn({ method: "POST" })
  .inputValidator(tokenOnly)
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    return { cleared: await unlinkGames(await admin(), user.id) };
  });
