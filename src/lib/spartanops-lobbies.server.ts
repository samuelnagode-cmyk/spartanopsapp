export async function hardDeleteLobbyById(supabaseAdmin: any, id: string) {
  // Delegate to the SECURITY DEFINER RPC which owns the correct deletion order
  // and bypasses table-level grants/RLS that would otherwise block direct
  // DELETEs on spartanops_game_state and friends.
  const { error } = await supabaseAdmin.rpc("spartanops_delete_lobby" as any, { p_lobby_id: id });
  if (error) throw new Error(error.message);
}