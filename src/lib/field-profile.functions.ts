import { createServerFn } from "@tanstack/react-start";
import { createHash, timingSafeEqual } from "node:crypto";
import { validLatLng, type LatLng } from "./events";
import { FIELD_MEDIA_BUCKET, MEDIA_LIMITS, fieldMediaUrl, sniffImage, type MediaKind } from "./field-media";

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
  .handler(async ({ data }): Promise<{ location: LatLng | null; logoUrl: string | null; mapUrl: string | null }> => {
    const id = await marshalId(data.accessToken);
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: p } = await db.from("spartanops_field_profiles").select("lat, lng, logo_path, map_path").eq("account_id", id).maybeSingle();
    return {
      location: p && p.lat !== null && p.lng !== null ? { lat: p.lat, lng: p.lng } : null,
      logoUrl: fieldMediaUrl(p?.logo_path), mapUrl: fieldMediaUrl(p?.map_path),
    };
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

/* ---------- field logo and field outline image ---------- */

const kindOf = (v: unknown): MediaKind => {
  if (v === "logo" || v === "map") return v;
  throw new Error("bad_kind");
};

async function removeMedia(accountId: string, kind: MediaKind) {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const col = kind === "logo" ? "logo_path" : "map_path";
  const { data: p } = await db.from("spartanops_field_profiles").select("logo_path, map_path").eq("account_id", accountId).maybeSingle();
  const old = p?.[col] ?? null;
  if (!p) return;
  const { error } = await db.from("spartanops_field_profiles").update({ [col]: null, media_updated_at: new Date().toISOString() } as never).eq("account_id", accountId);
  if (error) throw new Error("save_failed");
  if (old) await db.storage.from(FIELD_MEDIA_BUCKET).remove([old]).catch(() => undefined);
}

export const fieldMediaUpload = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { accessToken?: unknown; kind?: unknown; contentType?: unknown; base64?: unknown };
    return { accessToken: String(o.accessToken ?? ""), kind: o.kind, contentType: String(o.contentType ?? ""), base64: typeof o.base64 === "string" ? o.base64.slice(0, 1_200_000) : "" };
  })
  .handler(async ({ data }): Promise<{ url: string }> => {
    const id = await marshalId(data.accessToken);
    const kind = kindOf(data.kind);
    if (!["image/webp", "image/jpeg", "image/png"].includes(data.contentType)) throw new Error("bad_image");
    let bytes: Uint8Array;
    try { bytes = Uint8Array.from(atob(data.base64), (c) => c.charCodeAt(0)); } catch { throw new Error("bad_image"); }
    if (bytes.length === 0) throw new Error("bad_image");
    if (bytes.length > MEDIA_LIMITS[kind]) throw new Error("too_large");
    const sniff = sniffImage(bytes);
    if (!sniff || sniff.type !== data.contentType) throw new Error("bad_image");
    if (sniff.width !== null && sniff.height !== null
      && (sniff.width < 64 || sniff.height < 64 || sniff.width > 2000 || sniff.height > 2000)) throw new Error("bad_dimensions");

    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const { data: prev } = await db.from("spartanops_field_profiles").select("logo_path, map_path, media_updated_at").eq("account_id", id).maybeSingle();
    if (prev?.media_updated_at && Date.now() - Date.parse(prev.media_updated_at) < 3000) throw new Error("too_fast");

    const ext = sniff.type === "image/webp" ? "webp" : sniff.type === "image/jpeg" ? "jpg" : "png";
    const path = `${id}/${kind}-${crypto.randomUUID()}.${ext}`;
    const up = await db.storage.from(FIELD_MEDIA_BUCKET).upload(path, bytes, { contentType: sniff.type, cacheControl: "31536000", upsert: false });
    if (up.error) throw new Error("upload_failed");
    const col = kind === "logo" ? "logo_path" : "map_path";
    const { error } = await db.from("spartanops_field_profiles")
      .upsert({ account_id: id, [col]: path, media_updated_at: new Date().toISOString() } as never, { onConflict: "account_id" });
    if (error) {
      await db.storage.from(FIELD_MEDIA_BUCKET).remove([path]).catch(() => undefined);
      throw new Error("save_failed");
    }
    const old = prev?.[col];
    if (old && old !== path) await db.storage.from(FIELD_MEDIA_BUCKET).remove([old]).catch(() => undefined);
    return { url: fieldMediaUrl(path) as string };
  });

export const fieldMediaRemove = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { accessToken?: unknown; kind?: unknown };
    return { accessToken: String(o.accessToken ?? ""), kind: o.kind };
  })
  .handler(async ({ data }) => {
    const id = await marshalId(data.accessToken);
    await removeMedia(id, kindOf(data.kind));
    return { ok: true };
  });

/** Same constant-time master-password check as eventsAdminHide. */
function checkMaster(pw: unknown): boolean {
  const master = process.env.SPARTANOPS_MASTER_PASSWORD;
  if (!master) return false;
  if (typeof pw !== "string" || pw.length === 0 || pw.length > 200) return false;
  const a = createHash("sha256").update(pw, "utf8").digest();
  const b = createHash("sha256").update(master, "utf8").digest();
  return timingSafeEqual(a, b);
}

export const fieldMediaAdminRemove = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => {
    const o = (d ?? {}) as { masterPassword?: unknown; accountId?: unknown; kind?: unknown };
    return { masterPassword: o.masterPassword, accountId: String(o.accountId ?? ""), kind: o.kind };
  })
  .handler(async ({ data }) => {
    if (!checkMaster(data.masterPassword)) throw new Error("forbidden");
    if (!/^[0-9a-f-]{36}$/i.test(data.accountId)) throw new Error("not_found");
    const kinds: MediaKind[] = data.kind === "logo" || data.kind === "map" ? [data.kind] : ["logo", "map"];
    for (const k of kinds) await removeMedia(data.accountId, k);
    return { ok: true };
  });
