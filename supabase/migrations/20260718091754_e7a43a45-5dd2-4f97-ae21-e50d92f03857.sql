GRANT ALL ON public.spartanops_lobbies TO service_role;
GRANT ALL ON public.spartanops_game_state TO service_role;
GRANT ALL ON public.spartanops_checkins TO service_role;
GRANT ALL ON public.spartanops_checkin_secrets TO service_role;
GRANT ALL ON public.spartanops_captures TO service_role;
GRANT ALL ON public.spartanops_qr_anchors TO service_role;

CREATE OR REPLACE FUNCTION public.spartanops_delete_lobby(p_lobby_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_text_id text := p_lobby_id::text;
BEGIN
  -- Strict order: clear live state before removing the mission record.
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
$function$;

REVOKE ALL ON FUNCTION public.spartanops_delete_lobby(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spartanops_delete_lobby(uuid) TO service_role;