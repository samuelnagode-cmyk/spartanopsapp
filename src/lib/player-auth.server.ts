export async function requireUser(accessToken: unknown): Promise<{ id: string; email: string | null }> {
  if (typeof accessToken !== "string" || !accessToken) throw new Error("login_required");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
  if (error || !data?.user) throw new Error("login_required");
  return { id: data.user.id, email: data.user.email ?? null };
}

export async function isMarshal(userId: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("spartanops_accounts").select("id").eq("id", userId).maybeSingle();
  return !!data;
}
