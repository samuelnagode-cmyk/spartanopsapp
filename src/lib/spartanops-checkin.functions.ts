import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

const LEGACY_FIELDS = new Set(["zeleni-raj", "field-1", "field-2", "field-3"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isField(x: string): boolean {
  return LEGACY_FIELDS.has(x) || UUID_RE.test(x);
}

async function verifyMarshalAccess(fieldId: string, password: string, accessToken?: string): Promise<boolean> {
  if (UUID_RE.test(fieldId)) {
    const { isVerifiedLobbyOwner } = await import("./spartanops-owner-auth");
    if (await isVerifiedLobbyOwner(fieldId, accessToken)) return true;
  }
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

const EXP = new Set(["slabo", "dobro", "zelo_dobro"]);
const TEAMS = new Set(["none", "modra", "rdeca", "rumena"]);
const OPERATOR_TYPES = new Set(["AEG", "SNIPER", "DMR", "PUMP"]);

type CheckinInput = {
  fieldId: string;
  sessionId: string;
  callsign: string;
  firstName?: string | null;
  lastInitial?: string | null;
  club?: string | null;
  phoneNumber?: string | null;
  experienceLevel: string;
  operatorType: string;
  assignedTeam?: string;
  entryToken?: string;
  accessToken?: string;
};

// Field-entry guessing limits (per account + caller IP).
const FIELD_ATTEMPT_MAX_FAILURES = 10;
const FIELD_ATTEMPT_WINDOW_SEC = 10 * 60;
const FIELD_ATTEMPT_RETENTION_SEC = 24 * 3600;

/**
 * Registration gate: allowed if the lobby has no owning account, the caller is
 * the verified owner, the entry token is valid for the lobby's account at the
 * current password version, or this session already has a check-in in this field.
 */
async function canRegister(supabaseAdmin: any, fieldId: string, sessionId: string, entryToken?: string, accessToken?: string): Promise<boolean> {
  if (!UUID_RE.test(fieldId)) return true; // legacy/system fields
  const { data: lobby } = await supabaseAdmin
    .from("spartanops_lobbies").select("account_id").eq("id", fieldId).maybeSingle();
  const accountId = (lobby as any)?.account_id as string | null | undefined;
  if (!accountId) return false; // unowned UUID missions are refused
  const { isVerifiedLobbyOwner } = await import("./spartanops-owner-auth");
  if (await isVerifiedLobbyOwner(fieldId, accessToken)) return true;
  if (entryToken) {
    const { data: acc } = await supabaseAdmin
      .from("spartanops_accounts").select("field_password_version").eq("id", accountId).maybeSingle();
    const version = (acc as any)?.field_password_version;
    if (typeof version === "number") {
      const { verifyFieldToken } = await import("./spartanops-field-token");
      if (await verifyFieldToken(entryToken, accountId, version)) return true;
    }
  }
  const { data: sec } = await supabaseAdmin
    .from("spartanops_checkin_secrets").select("checkin_id").eq("session_id", sessionId).maybeSingle();
  const existingId = (sec as any)?.checkin_id as string | undefined;
  if (existingId) {
    const { data: ci } = await supabaseAdmin
      .from("spartanops_checkins").select("field_id").eq("id", existingId).maybeSingle();
    if ((ci as any)?.field_id === fieldId) return true;
  }
  return false;
}

/**
 * Upsert a player/marshal check-in. Session token + PII live in the private
 * spartanops_checkin_secrets table, which is invisible to public clients.
 */
export const spartanopsUpsertCheckin = createServerFn({ method: "POST" })
  .inputValidator((d: CheckinInput) => {
    if (!isField(String(d?.fieldId ?? ""))) throw new Error("Invalid field");
    const sid = String(d?.sessionId ?? "");
    if (!sid || sid.length > 100) throw new Error("Invalid session");
    const cs = String(d?.callsign ?? "").trim();
    if (!cs || cs.length > 40) throw new Error("Invalid callsign");
    const exp = String(d?.experienceLevel ?? "dobro");
    if (!EXP.has(exp)) throw new Error("Invalid experience");
    const operatorType = String(d?.operatorType ?? "").toUpperCase();
    if (!OPERATOR_TYPES.has(operatorType)) throw new Error("Invalid operator type");
    const team = String(d?.assignedTeam ?? "none");
    if (!TEAMS.has(team)) throw new Error("Invalid team");
    const clip = (v: unknown, max: number) => {
      if (v == null) return null;
      const s = String(v).trim();
      if (!s) return null;
      if (s.length > max) throw new Error("Field too long");
      return s;
    };
    return {
      fieldId: d.fieldId,
      sessionId: sid,
      callsign: cs,
      firstName: clip(d.firstName, 80),
      lastInitial: clip(d.lastInitial, 4),
      club: clip(d.club, 80),
      phoneNumber: clip(d.phoneNumber, 40),
      experienceLevel: exp,
      operatorType,
      assignedTeam: team,
      entryToken: typeof d.entryToken === "string" ? d.entryToken.slice(0, 1000) : undefined,
      accessToken: typeof d.accessToken === "string" ? d.accessToken.slice(0, 4000) : undefined,
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!(await canRegister(supabaseAdmin, data.fieldId, data.sessionId, data.entryToken, data.accessToken))) {
      throw new Error("field_entry_required");
    }

    // 1. Look up existing checkin via secrets.session_id.
    const { data: existing } = await supabaseAdmin
      .from("spartanops_checkin_secrets" as any)
      .select("checkin_id")
      .eq("session_id", data.sessionId)
      .maybeSingle();

    let checkinId: string | null = (existing as any)?.checkin_id ?? null;

    if (checkinId) {
      const { error: uErr } = await supabaseAdmin
        .from("spartanops_checkins")
        .update({
          field_id: data.fieldId,
          callsign: data.callsign,
          experience_level: data.experienceLevel,
          operator_type: data.operatorType,
          assigned_team: data.assignedTeam,
        } as any)
        .eq("id", checkinId);
      if (uErr) throw new Error(uErr.message);
    } else {
      // Plan player cap: only new check-ins count. The verified mission owner is exempt.
      const { isVerifiedLobbyOwner } = await import("./spartanops-owner-auth");
      if (!(await isVerifiedLobbyOwner(data.fieldId, data.accessToken))) {
        const { enforcePlayerCap } = await import("./spartanops-plan-limits");
        await enforcePlayerCap(data.fieldId);
      }
      const { data: inserted, error: iErr } = await supabaseAdmin
        .from("spartanops_checkins")
        .insert({
          field_id: data.fieldId,
          callsign: data.callsign,
          experience_level: data.experienceLevel,
          operator_type: data.operatorType,
          assigned_team: data.assignedTeam,
        } as any)
        .select("id")
        .single();
      if (iErr) throw new Error(iErr.message);
      checkinId = (inserted as any).id as string;
    }

    // 2. Upsert secrets row.
    const { error: sErr } = await supabaseAdmin
      .from("spartanops_checkin_secrets" as any)
      .upsert(
        {
          checkin_id: checkinId,
          session_id: data.sessionId,
          first_name: data.firstName,
          last_initial: data.lastInitial,
          club: data.club,
          phone_number: data.phoneNumber,
          updated_at: new Date().toISOString(),
        } as any,
        { onConflict: "checkin_id" },
      );
    if (sErr) throw new Error(sErr.message);

    return { ok: true as const };
  });

/**
 * Fetch the caller's own check-in row (including PII they submitted).
 */
export const spartanopsGetMyCheckin = createServerFn({ method: "POST" })
  .inputValidator((d: { fieldId: string; sessionId: string }) => {
    if (!isField(String(d?.fieldId ?? ""))) throw new Error("Invalid field");
    const sid = String(d?.sessionId ?? "");
    if (!sid || sid.length > 100) throw new Error("Invalid session");
    return { fieldId: d.fieldId, sessionId: sid };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: secret } = await supabaseAdmin
      .from("spartanops_checkin_secrets" as any)
      .select("checkin_id, first_name, last_initial, club")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!secret) return { ok: true as const, row: null };
    const { data: row, error } = await supabaseAdmin
      .from("spartanops_checkins")
      .select("id, field_id, callsign, experience_level, operator_type, assigned_team, team_changed_flag, created_at, warning_message" as any)
      .eq("id", (secret as any).checkin_id)
      .eq("field_id", data.fieldId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!row) return { ok: true as const, row: null };
    const s = secret as any;
    return {
      ok: true as const,
      row: {
        ...(row as any),
        session_id: data.sessionId,
        first_name: s.first_name ?? null,
        last_initial: s.last_initial ?? null,
        club: s.club ?? null,
      },
    };
  });

/** Resolve the active mission for a private player session token. */
export const spartanopsResolveSessionField = createServerFn({ method: "POST" })
  .inputValidator((d: { sessionId: string }) => {
    const sid = String(d?.sessionId ?? "");
    if (!sid || sid.length > 100) throw new Error("Invalid session");
    return { sessionId: sid };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: secret } = await supabaseAdmin
      .from("spartanops_checkin_secrets" as any)
      .select("checkin_id")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!secret) return { ok: false as const, fieldId: null };

    const { data: row, error } = await supabaseAdmin
      .from("spartanops_checkins")
      .select("field_id")
      .eq("id", (secret as any).checkin_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const fieldId = typeof (row as any)?.field_id === "string" ? (row as any).field_id : null;
    return { ok: Boolean(fieldId) as boolean, fieldId };
  });

/**
 * Remove the caller's own check-in row for a field.
 */
export const spartanopsDeleteMyCheckin = createServerFn({ method: "POST" })
  .inputValidator((d: { fieldId: string; sessionId: string }) => {
    if (!isField(String(d?.fieldId ?? ""))) throw new Error("Invalid field");
    const sid = String(d?.sessionId ?? "");
    if (!sid || sid.length > 100) throw new Error("Invalid session");
    return { fieldId: d.fieldId, sessionId: sid };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: secret } = await supabaseAdmin
      .from("spartanops_checkin_secrets" as any)
      .select("checkin_id")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!secret) return { ok: true as const };
    const { error } = await supabaseAdmin
      .from("spartanops_checkins")
      .delete()
      .eq("id", (secret as any).checkin_id)
      .eq("field_id", data.fieldId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Persist a player respawn cooldown on the backend so browser navigation cannot bypass it. */
export const spartanopsSetRespawnLock = createServerFn({ method: "POST" })
  .inputValidator((d: { fieldId: string; sessionId: string; seconds: number }) => {
    if (!isField(String(d?.fieldId ?? ""))) throw new Error("Invalid field");
    const sid = String(d?.sessionId ?? "");
    if (!sid || sid.length > 100) throw new Error("Invalid session");
    const seconds = Math.max(0, Math.min(60 * 60, Math.round(Number(d?.seconds ?? 0))));
    return { fieldId: d.fieldId, sessionId: sid, seconds };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: secret } = await supabaseAdmin
      .from("spartanops_checkin_secrets" as any)
      .select("checkin_id")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!secret) return { ok: false as const, unlockAt: null };

    const { data: row } = await supabaseAdmin
      .from("spartanops_checkins")
      .select("id")
      .eq("id", (secret as any).checkin_id)
      .eq("field_id", data.fieldId)
      .maybeSingle();
    if (!row) return { ok: false as const, unlockAt: null };

    const unlockAt = data.seconds > 0 ? new Date(Date.now() + data.seconds * 1000).toISOString() : null;
    const { error } = await supabaseAdmin
      .from("spartanops_checkin_secrets" as any)
      .update({ respawn_unlock_at: unlockAt, updated_at: new Date().toISOString() } as any)
      .eq("checkin_id", (secret as any).checkin_id);
    if (error) throw new Error(error.message);
    // Increment public death counter whenever a new respawn lock is opened.
    if (data.seconds > 0) {
      const { data: current } = await supabaseAdmin
        .from("spartanops_checkins")
        .select("death_count")
        .eq("id", (secret as any).checkin_id)
        .maybeSingle();
      const next = Number((current as any)?.death_count ?? 0) + 1;
      await supabaseAdmin
        .from("spartanops_checkins")
        .update({ death_count: next } as any)
        .eq("id", (secret as any).checkin_id);
    }
    return { ok: true as const, unlockAt };
  });

/** Read the caller's active respawn lock, if any. */
export const spartanopsGetRespawnLock = createServerFn({ method: "POST" })
  .inputValidator((d: { fieldId: string; sessionId: string }) => {
    if (!isField(String(d?.fieldId ?? ""))) throw new Error("Invalid field");
    const sid = String(d?.sessionId ?? "");
    if (!sid || sid.length > 100) throw new Error("Invalid session");
    return { fieldId: d.fieldId, sessionId: sid };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: secret } = await supabaseAdmin
      .from("spartanops_checkin_secrets" as any)
      .select("checkin_id, respawn_unlock_at")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!secret) return { ok: true as const, unlockAt: null };

    const { data: row } = await supabaseAdmin
      .from("spartanops_checkins")
      .select("id")
      .eq("id", (secret as any).checkin_id)
      .eq("field_id", data.fieldId)
      .maybeSingle();
    if (!row) return { ok: true as const, unlockAt: null };

    const raw = (secret as any).respawn_unlock_at;
    const unlockMs = raw ? Date.parse(raw) : NaN;
    return { ok: true as const, unlockAt: Number.isFinite(unlockMs) && unlockMs > Date.now() ? raw : null };
  });

/**
 * Public list of cancelled event ids.
 */
export const listEventCancellations = createServerFn({ method: "GET" }).handler(
  async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("event_cancellations")
      .select("event_id");
    if (error) throw new Error(error.message);
    return { ok: true as const, ids: (data ?? []).map((r: any) => r.event_id as string) };
  },
);

/**
 * Marshal-authenticated roster fetch including PII.
 */
export const spartanopsAdminGetRoster = createServerFn({ method: "POST" })
  .inputValidator((d: { fieldId: string; password: string; accessToken?: string }) => ({
    fieldId: String(d?.fieldId ?? ""),
    password: String(d?.password ?? ""),
    accessToken: d?.accessToken ? String(d.accessToken) : undefined,
  }))
  .handler(async ({ data }) => {
    if (!isField(data.fieldId)) throw new Error("Invalid field");
    const authorized = await verifyMarshalAccess(data.fieldId, data.password, data.accessToken);
    if (!authorized) {
      return { ok: false as const, rows: [], plan: null };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("spartanops_checkins")
      .select("id, field_id, callsign, experience_level, operator_type, assigned_team, team_changed_flag, death_count, created_at")
      .eq("field_id", data.fieldId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r: any) => r.id as string);
    let secretsMap = new Map<string, any>();
    if (ids.length > 0) {
      const { data: secrets } = await supabaseAdmin
        .from("spartanops_checkin_secrets" as any)
        .select("checkin_id, session_id, first_name, last_initial, club, phone_number, respawn_unlock_at")
        .in("checkin_id", ids);
      for (const s of (secrets ?? []) as any[]) {
        secretsMap.set(s.checkin_id, s);
      }
    }
    const merged = (rows ?? []).map((r: any) => {
      const s = secretsMap.get(r.id);
      return {
        ...r,
        session_id: s?.session_id ?? null,
        first_name: s?.first_name ?? null,
        last_initial: s?.last_initial ?? null,
        club: s?.club ?? null,
        phone_number: s?.phone_number ?? null,
        respawn_unlock_at: s?.respawn_unlock_at ?? null,
      };
    });
    // Plan of the mission's owner, read with service role after the marshal check above
    // (a password-only marshal cannot read the plan row under RLS). Null = no limit.
    let plan: { plan: "free" | "founding" | "pro"; maxPlayers: number; fieldName: string | null; accountId: string } | null = null;
    try {
      const { lobbyAccountId, getAccountLimits } = await import("@/lib/spartanops-plan-limits");
      const accountId = await lobbyAccountId(data.fieldId);
      if (accountId) {
        const { data: acct } = await supabaseAdmin
          .from("spartanops_accounts").select("business_name, is_platform_showcase").eq("id", accountId).maybeSingle();
        if (acct && !acct.is_platform_showcase) {
          const l = await getAccountLimits(accountId);
          plan = { plan: l.plan, maxPlayers: l.maxPlayers, fieldName: acct.business_name ?? null, accountId };
        }
      }
    } catch { plan = null; }
    return { ok: true as const, rows: merged, plan };
  });

/**
 * Participant-scoped roster fetch. A player can see callsigns, faction, rank,
 * and submitted first-name + surname initial only after their session is
 * checked in to the same mission.
 */
export const spartanopsGetParticipantRoster = createServerFn({ method: "POST" })
  .inputValidator((d: { fieldId: string; sessionId: string }) => {
    if (!isField(String(d?.fieldId ?? ""))) throw new Error("Invalid field");
    const sid = String(d?.sessionId ?? "");
    if (!sid || sid.length > 100) throw new Error("Invalid session");
    return { fieldId: d.fieldId, sessionId: sid };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ownSecret } = await supabaseAdmin
      .from("spartanops_checkin_secrets" as any)
      .select("checkin_id")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!ownSecret) return { ok: false as const, rows: [] };

    const { data: ownRow } = await supabaseAdmin
      .from("spartanops_checkins")
      .select("id")
      .eq("id", (ownSecret as any).checkin_id)
      .eq("field_id", data.fieldId)
      .maybeSingle();
    if (!ownRow) return { ok: false as const, rows: [] };

    const { data: rows, error } = await supabaseAdmin
      .from("spartanops_checkins")
      .select("id, field_id, callsign, experience_level, operator_type, assigned_team, team_changed_flag, death_count, created_at")
      .eq("field_id", data.fieldId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r: any) => r.id as string);
    const secretsMap = new Map<string, any>();
    if (ids.length > 0) {
      const { data: secrets } = await supabaseAdmin
        .from("spartanops_checkin_secrets" as any)
        .select("checkin_id, first_name, last_initial, club, respawn_unlock_at")
        .in("checkin_id", ids);
      for (const s of (secrets ?? []) as any[]) secretsMap.set(s.checkin_id, s);
    }

    return {
      ok: true as const,
      rows: (rows ?? []).map((r: any) => {
        const s = secretsMap.get(r.id);
        return {
          ...r,
          first_name: s?.first_name ?? null,
          last_initial: s?.last_initial ?? null,
          club: s?.club ?? null,
          respawn_unlock_at: s?.respawn_unlock_at ?? null,
        };
      }),
    };
  });

/** Current backend clock for drift-free countdowns across devices. POST avoids stale cached clock responses. */
export const spartanopsGetServerTime = createServerFn({ method: "POST" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store, max-age=0");
  return { serverTime: new Date().toISOString(), serverNow: Date.now() };
});

/** Capture safety net: returns only callsign + team for the caller's own check-in. */
export const spartanopsGetOwnCheckinTeam = createServerFn({ method: "POST" })
  .inputValidator((d: { fieldId: string; sessionId: string }) => ({
    fieldId: String(d?.fieldId ?? "").slice(0, 200),
    sessionId: String(d?.sessionId ?? "").slice(0, 200),
  }))
  .handler(async ({ data }) => {
    if (!isField(data.fieldId) || data.sessionId.length < 8) return { callsign: null, assigned_team: null };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let checkinId: string | null = null;
    const { data: sec } = await supabaseAdmin
      .from("spartanops_checkin_secrets")
      .select("checkin_id")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (sec?.checkin_id) checkinId = sec.checkin_id;
    else if (UUID_RE.test(data.sessionId)) checkinId = data.sessionId;
    if (!checkinId) return { callsign: null, assigned_team: null };
    const { data: row } = await supabaseAdmin
      .from("spartanops_checkins")
      .select("callsign, assigned_team")
      .eq("id", checkinId)
      .eq("field_id", data.fieldId)
      .maybeSingle();
    return { callsign: row?.callsign ?? null, assigned_team: row?.assigned_team ?? null };
  });

export const spartanopsVerifyFieldPassword = createServerFn({ method: "POST" })
  .inputValidator((d: { accountId: string; password: string }) => ({
    accountId: String(d?.accountId ?? ""),
    password: String(d?.password ?? ""),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: ok, error } = await supabaseAdmin.rpc("spartanops_verify_field_password" as any, {
      p_account_id: data.accountId,
      p_password: data.password,
    });
    if (error) throw new Error(error.message);
    return { ok: ok === true };
  });

export const spartanopsGetFieldPublicInfo = createServerFn({ method: "POST" })
  .inputValidator((d: { code?: string; id?: string }) => ({
    code: String(d?.code ?? "").trim().toUpperCase(),
    id: String(d?.id ?? "").trim(),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("spartanops_accounts").select("id, business_name, field_password_hash");
    if (/^[A-Z2-9]{6}$/.test(data.code)) q = q.eq("field_code" as any, data.code);
    else if (/^[0-9a-f-]{36}$/i.test(data.id)) q = q.eq("id", data.id);
    else return { found: false as const };
    const { data: row } = await q.maybeSingle();
    if (!row) return { found: false as const };
    return { found: true as const, accountId: (row as any).id as string, name: (row as any).business_name as string, hasPassword: !!(row as any).field_password_hash };
  });

export const spartanopsEnterField = createServerFn({ method: "POST" })
  .inputValidator((d: { accountId: string; password: string }) => ({
    accountId: String(d?.accountId ?? ""),
    password: String(d?.password ?? "").trim().toLowerCase(),
  }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!UUID_RE.test(data.accountId)) return { ok: false as const };
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const ip = (getRequestHeader("cf-connecting-ip") || (getRequestHeader("x-forwarded-for") ?? "").split(",")[0] || "unknown").trim();
    const secret = process.env.FIELD_ENTRY_SECRET ?? "";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + secret));
    const ipHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");

    const since = new Date(Date.now() - FIELD_ATTEMPT_WINDOW_SEC * 1000).toISOString();
    const { data: recent } = await supabaseAdmin
      .from("spartanops_field_attempts" as any)
      .select("at")
      .eq("account_id", data.accountId).eq("ip_hash", ipHash).gte("at", since)
      .order("at", { ascending: true })
      .limit(FIELD_ATTEMPT_MAX_FAILURES);
    if ((recent?.length ?? 0) >= FIELD_ATTEMPT_MAX_FAILURES) {
      const oldest = new Date((recent as any)[0].at).getTime();
      const retryAfterSec = Math.max(1, Math.ceil((oldest + FIELD_ATTEMPT_WINDOW_SEC * 1000 - Date.now()) / 1000));
      return { ok: false as const, throttled: true as const, retryAfterSec };
    }

    const { data: ok } = await supabaseAdmin.rpc("spartanops_verify_field_password" as any, {
      p_account_id: data.accountId, p_password: data.password,
    });
    if (ok !== true) {
      await supabaseAdmin.from("spartanops_field_attempts" as any).insert({ account_id: data.accountId, ip_hash: ipHash } as any);
      await supabaseAdmin.from("spartanops_field_attempts" as any).delete()
        .eq("account_id", data.accountId)
        .lt("at", new Date(Date.now() - FIELD_ATTEMPT_RETENTION_SEC * 1000).toISOString());
      return { ok: false as const };
    }
    const { data: row } = await supabaseAdmin
      .from("spartanops_accounts").select("business_name, active_lobby_id, field_password_version" as any).eq("id", data.accountId).maybeSingle();
    const { signFieldToken } = await import("./spartanops-field-token");
    const token = await signFieldToken(data.accountId, Number((row as any)?.field_password_version ?? 1));
    return { ok: true as const, token, name: ((row as any)?.business_name ?? "") as string, activeLobbyId: ((row as any)?.active_lobby_id ?? null) as string | null };
  });

// ---- Public Join directory (names only) ----
const FIELD_LIST_ALL_MAX = 30;
const FIELD_SEARCH_LIMIT = 20;

export function spartanopsFoldQuery(q: string): string {
  return q.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
}

export const spartanopsListFields = createServerFn({ method: "POST" })
  .inputValidator((d: { q?: string }) => ({ q: String(d?.q ?? "").slice(0, 80) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const base = () => supabaseAdmin.from("spartanops_accounts")
      .select("id, business_name, city, country" as any, { count: "exact" })
      .eq("listed_publicly" as any, true).eq("listing_blocked" as any, false)
      .not("field_password_hash", "is", null);
    const folded = spartanopsFoldQuery(data.q);
    const map = (rows: any[] | null) => (rows ?? []).map((r) => ({ id: r.id as string, name: r.business_name as string, city: (r.city ?? null) as string | null, country: (r.country ?? null) as string | null }));
    if (folded.length >= 2) {
      const pat = folded.replace(/[\\%_]/g, (c) => "\\" + c);
      const { data: rows, count } = await base().or(`name_fold.ilike.%${pat}%,city_fold.ilike.%${pat}%`).order("business_name").limit(FIELD_SEARCH_LIMIT);
      return { mode: "search" as const, fields: map(rows), total: count ?? 0 };
    }
    const { count } = await supabaseAdmin.from("spartanops_accounts").select("id", { count: "exact", head: true })
      .eq("listed_publicly" as any, true).eq("listing_blocked" as any, false).not("field_password_hash", "is", null);
    const total = count ?? 0;
    if (total > FIELD_LIST_ALL_MAX) return { mode: "prompt" as const, fields: [] as { id: string; name: string; city: string | null; country: string | null }[], total };
    const { data: rows } = await base().order("business_name");
    return { mode: "all" as const, fields: map(rows), total };
  });

export const spartanopsResumeField = createServerFn({ method: "POST" })
  .inputValidator((d: { accountId: string; token: string }) => ({
    accountId: String(d?.accountId ?? ""),
    token: String(d?.token ?? "").slice(0, 1000),
  }))
  .handler(async ({ data }) => {
    try {
      if (!UUID_RE.test(data.accountId) || !data.token) return { ok: false as const };
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: row } = await supabaseAdmin.from("spartanops_accounts")
        .select("business_name, active_lobby_id, field_password_version" as any).eq("id", data.accountId).maybeSingle();
      if (!row) return { ok: false as const };
      const version = Number((row as any).field_password_version ?? 1);
      const { verifyFieldToken, signFieldToken } = await import("./spartanops-field-token");
      if (!(await verifyFieldToken(data.token, data.accountId, version))) return { ok: false as const };
      const token = await signFieldToken(data.accountId, version);
      return { ok: true as const, name: ((row as any).business_name ?? "") as string, activeLobbyId: ((row as any).active_lobby_id ?? null) as string | null, token };
    } catch {
      return { ok: false as const };
    }
  });
