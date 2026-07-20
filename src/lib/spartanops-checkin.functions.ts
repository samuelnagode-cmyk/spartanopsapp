import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";

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

const EXP = new Set(["slabo", "dobro", "zelo_dobro"]);
const TEAMS = new Set(["none", "modra", "rdeca", "rumena"]);

type CheckinInput = {
  fieldId: string;
  sessionId: string;
  callsign: string;
  firstName?: string | null;
  lastInitial?: string | null;
  club?: string | null;
  experienceLevel: string;
  assignedTeam?: string;
};

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
      experienceLevel: exp,
      assignedTeam: team,
    };
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

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
          assigned_team: data.assignedTeam,
        } as any)
        .eq("id", checkinId);
      if (uErr) throw new Error(uErr.message);
    } else {
      const { data: inserted, error: iErr } = await supabaseAdmin
        .from("spartanops_checkins")
        .insert({
          field_id: data.fieldId,
          callsign: data.callsign,
          experience_level: data.experienceLevel,
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
      .select("id, field_id, callsign, experience_level, assigned_team, team_changed_flag, created_at, warning_message" as any)
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
  .inputValidator((d: { fieldId: string; password: string }) => ({
    fieldId: String(d?.fieldId ?? ""),
    password: String(d?.password ?? ""),
  }))
  .handler(async ({ data }) => {
    if (!isField(data.fieldId)) throw new Error("Invalid field");
    const authorized = await verifyMarshalAccess(data.fieldId, data.password);
    if (!authorized) {
      return { ok: false as const, rows: [] };
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("spartanops_checkins")
      .select("id, field_id, callsign, experience_level, assigned_team, team_changed_flag, created_at")
      .eq("field_id", data.fieldId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r: any) => r.id as string);
    let secretsMap = new Map<string, any>();
    if (ids.length > 0) {
      const { data: secrets } = await supabaseAdmin
        .from("spartanops_checkin_secrets" as any)
        .select("checkin_id, session_id, first_name, last_initial, club")
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
      };
    });
    return { ok: true as const, rows: merged };
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
      .select("id, field_id, callsign, experience_level, assigned_team, team_changed_flag, created_at")
      .eq("field_id", data.fieldId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (rows ?? []).map((r: any) => r.id as string);
    const secretsMap = new Map<string, any>();
    if (ids.length > 0) {
      const { data: secrets } = await supabaseAdmin
        .from("spartanops_checkin_secrets" as any)
        .select("checkin_id, first_name, last_initial, club")
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
        };
      }),
    };
  });

/** Current backend clock for drift-free countdowns across devices. POST avoids stale cached clock responses. */
export const spartanopsGetServerTime = createServerFn({ method: "POST" }).handler(async () => {
  setResponseHeader("Cache-Control", "no-store, max-age=0");
  return { serverTime: new Date().toISOString(), serverNow: Date.now() };
});
