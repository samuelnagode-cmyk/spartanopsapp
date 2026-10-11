import { createServerFn } from "@tanstack/react-start";
import { validLatLng, type LatLng } from "./events";

/** The field's exact default location. The account id always comes from the verified token. */
async function marshalId(accessToken: unknown): Promise<string> {
  if (typeof accessToken !== "string" || !accessToken) throw new Error("login_required");
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data: u, error } = await db.auth.getUser(accessToken);
  if (error || !u?.user) throw new Error("login_required");
  const { data: acc } = await db.from("spartanops_accounts").select("id").eq("id", u.user.id).maybeSingle();
  if (!acc) throw new Error("account_required");
  return u.user.id;
}

export const fieldProfileGetMine = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ({ accessToken: String((d as { accessToken?: unknown })?.accessToken ?? "") }))
  .handler(async ({ data }): Promise<{ location: LatLng | null }> => {
    const id = await marshalId(data.accessToken);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: p } = await db.from("spartanops_field_profiles").select("lat, lng").eq("account_id", id).maybeSingle();
    return { location: p && p.lat !== null && p.lng !== null ? { lat: p.lat, lng: p.lng } : null };
  });

export const fieldProfileSave = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { accessToken?: unknown; lat?: unknown; lng?: unknown };
    const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v));
    return { accessToken: String(o.accessToken ?? ""), lat: num(o.lat), lng: num(o.lng) };
  })
  .handler(async ({ data }) => {
    const id = await marshalId(data.accessToken);
    if ((data.lat === null) !== (data.lng === null)) throw new Error("validation:location");
    if (data.lat !== null && !validLatLng(data.lat, data.lng as number)) throw new Error("validation:location");
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { error } = await db.from("spartanops_field_profiles")
      .upsert({ account_id: id, lat: data.lat, lng: data.lng, updated_at: new Date().toISOString() }, { onConflict: "account_id" });
    if (error) throw new Error("save_failed");
    return { ok: true };
  });
