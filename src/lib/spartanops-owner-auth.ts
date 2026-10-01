export async function isVerifiedLobbyOwner(lobbyId: string, accessToken: string | undefined): Promise<boolean> {
  if (!accessToken || !lobbyId) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: userData } = await supabaseAdmin.auth.getUser(accessToken);
  if (!userData?.user) return false;
  const { data: lobby } = await supabaseAdmin
    .from("spartanops_lobbies")
    .select("account_id")
    .eq("id", lobbyId)
    .maybeSingle();
  return !!lobby?.account_id && lobby.account_id === userData.user.id;
}
