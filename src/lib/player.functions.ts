import { createServerFn } from "@tanstack/react-start";
import { PRIVACY_VERSION, validatePlayer, type PlayerInput } from "./player-validation";
import { requireUser, isMarshal } from "./player-auth.server";

type TokenIn = { accessToken: string };
const tokenOnly = (d: unknown): TokenIn => ({ accessToken: String((d as TokenIn)?.accessToken ?? "") });

const COLS = "nickname, first_name, last_name, show_full_last_name, age_group, phone, club, experience_level, operator_type, primary_weapon, secondary_weapon, sidearm, gear_notes, privacy_version, privacy_accepted_at, created_at, updated_at";

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
    const { data: existing } = await db.from("spartanops_players").select("privacy_version").eq("user_id", user.id).maybeSingle();
    const needsConsent = !existing || existing.privacy_version !== PRIVACY_VERSION;
    if (needsConsent && !data.privacyAccepted) throw new Error("validation:privacy");
    const now = new Date().toISOString();
    const row = {
      user_id: user.id,
      ...v.data,
      updated_at: now,
      ...(needsConsent ? { privacy_version: PRIVACY_VERSION, privacy_accepted_at: now } : {}),
    };
    const { data: saved, error } = await db
      .from("spartanops_players")
      .upsert(row as never, { onConflict: "user_id" })
      .select(COLS)
      .single();
    if (error) { console.error("[playerSaveMine]", error.code); throw new Error("save_failed"); }
    return { profile: saved };
  });

export const playerExportMine = createServerFn({ method: "POST" })
  .inputValidator(tokenOnly)
  .handler(async ({ data }) => {
    const user = await requireUser(data.accessToken);
    const db = await admin();
    const { data: profile } = await db.from("spartanops_players").select(COLS).eq("user_id", user.id).maybeSingle();
    return { exported_at: new Date().toISOString(), account: { email: user.email }, profile: profile ?? null };
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
    const { error } = await db.from("spartanops_players").delete().eq("user_id", user.id);
    if (error) throw new Error("delete_failed");
    if (await isMarshal(user.id)) return { keptLogin: true };
    const { error: delErr } = await db.auth.admin.deleteUser(user.id);
    if (delErr) throw new Error("delete_failed");
    return { keptLogin: false };
  });
