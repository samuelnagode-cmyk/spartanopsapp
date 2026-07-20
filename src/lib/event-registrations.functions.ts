import { createServerFn } from "@tanstack/react-start";

async function verifyTabPassword(tab: string, password: string): Promise<boolean> {
  if (typeof password !== "string" || password.length > 200) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("verify_field_password" as any, {
    p_field_id: tab,
    p_password: password,
  });
  if (error) return false;
  return data === true;
}

/**
 * Admin-only fetch of full registration rows including PII. The "prijave" tab
 * password is validated server-side against the bcrypt hash stored in the
 * spartanops_field_secrets table — no password ever lives in source code.
 */
export const getAdminRegistrations = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string }) => {
    if (typeof data?.password !== "string") throw new Error("Invalid input");
    return { password: data.password };
  })
  .handler(async ({ data }) => {
    if (!(await verifyTabPassword("prijave", data.password))) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("registrations")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { ok: true as const, rows: rows ?? [] };
  });

/** Admin-only delete of a single registration by id. */
export const deleteAdminRegistration = createServerFn({ method: "POST" })
  .inputValidator((data: { password: string; id: string }) => {
    if (typeof data?.password !== "string" || typeof data?.id !== "string") throw new Error("Invalid input");
    return { password: data.password, id: data.id };
  })
  .handler(async ({ data }) => {
    if (!(await verifyTabPassword("prijave", data.password))) return { ok: false as const };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("registrations").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });
