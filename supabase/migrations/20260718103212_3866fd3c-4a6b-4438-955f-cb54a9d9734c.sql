ALTER TABLE public.spartanops_game_state REPLICA IDENTITY FULL;

CREATE OR REPLACE FUNCTION public.spartanops_delete_lobby(p_lobby_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_text_id text := p_lobby_id::text;
BEGIN
  -- Strict decommission order. Realtime DELETEs on game_state require
  -- replica identity because this table is published for live updates.
  DELETE FROM public.spartanops_game_state
   WHERE field_id = v_text_id OR id = v_text_id;

  DELETE FROM public.spartanops_qr_anchors
   WHERE field_id = v_text_id;

  DELETE FROM public.spartanops_captures
   WHERE field_id = v_text_id;

  DELETE FROM public.spartanops_checkin_secrets s
   USING public.spartanops_checkins c
   WHERE s.checkin_id = c.id
     AND c.field_id = v_text_id;

  DELETE FROM public.spartanops_checkins
   WHERE field_id = v_text_id;

  DELETE FROM public.spartanops_lobbies
   WHERE id = p_lobby_id;
END;
$$;

REVOKE ALL ON FUNCTION public.spartanops_delete_lobby(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spartanops_delete_lobby(uuid) TO service_role;