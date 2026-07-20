import { createServerFn } from "@tanstack/react-start";

/**
 * Player-facing server functions that wrap the SECURITY DEFINER RPCs.
 * The underlying SQL functions have EXECUTE revoked from anon/authenticated,
 * so they can only be invoked from this trusted server-role path.
 */

const LEGACY_FIELDS = new Set(["zeleni-raj", "field-1", "field-2", "field-3"]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isField(x: string): boolean {
  return LEGACY_FIELDS.has(x) || UUID_RE.test(x);
}

export const spartanopsApplyCapture = createServerFn({ method: "POST" })
  .inputValidator((d: { fieldId: string; point: number; sessionId: string }) => ({
    fieldId: String(d?.fieldId ?? ""),
    point: Number(d?.point),
    sessionId: String(d?.sessionId ?? ""),
  }))
  .handler(async ({ data }) => {
    if (!isField(data.fieldId)) throw new Error("Invalid field");
    if (![1, 2, 3, 4, 5].includes(data.point)) throw new Error("Invalid point");
    if (!data.sessionId || data.sessionId.length > 100) throw new Error("Invalid session");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: result, error } = await supabaseAdmin.rpc("spartanops_apply_capture" as any, {
      p_field_id: data.fieldId,
      p_point: data.point,
      p_session_id: data.sessionId,
    });
    if (error) throw new Error(error.message);
    return result as { ok: boolean; team?: string; error?: string; ended?: boolean; already_held?: boolean };
  });

export const spartanopsAckTeamChange = createServerFn({ method: "POST" })
  .inputValidator((d: { fieldId: string; sessionId: string }) => ({
    fieldId: String(d?.fieldId ?? ""),
    sessionId: String(d?.sessionId ?? ""),
  }))
  .handler(async ({ data }) => {
    if (!isField(data.fieldId)) throw new Error("Invalid field");
    if (!data.sessionId || data.sessionId.length > 100) throw new Error("Invalid session");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("spartanops_acknowledge_team_change" as any, {
      p_field_id: data.fieldId,
      p_session_id: data.sessionId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const spartanopsSelectTeam = createServerFn({ method: "POST" })
  .inputValidator((d: { fieldId: string; sessionId: string; team: "modra" | "rdeca" | "rumena" }) => ({
    fieldId: String(d?.fieldId ?? ""),
    sessionId: String(d?.sessionId ?? ""),
    team: d?.team,
  }))
  .handler(async ({ data }) => {
    if (!isField(data.fieldId)) throw new Error("Invalid field");
    if (!data.sessionId || data.sessionId.length > 100) throw new Error("Invalid session");
    if (!["modra", "rdeca", "rumena"].includes(data.team)) throw new Error("Invalid team");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: secret } = await supabaseAdmin
      .from("spartanops_checkin_secrets" as any)
      .select("checkin_id")
      .eq("session_id", data.sessionId)
      .maybeSingle();
    if (!secret) throw new Error("not_checked_in");
    const { error } = await supabaseAdmin
      .from("spartanops_checkins")
      .update({ assigned_team: data.team, team_changed_flag: false } as any)
      .eq("field_id", data.fieldId)
      .eq("id", (secret as any).checkin_id);

    if (error) throw new Error(error.message);
    return { ok: true, team: data.team };
  });
