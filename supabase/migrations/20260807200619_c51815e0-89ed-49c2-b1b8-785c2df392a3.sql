CREATE OR REPLACE FUNCTION public.spartanops_reset_match_runtime(p_field_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '60s'
AS $function$
BEGIN
  DELETE FROM public.spartanops_captures
   WHERE field_id = p_field_id;

  DELETE FROM public.spartanops_qr_anchors
   WHERE field_id = p_field_id;

  UPDATE public.spartanops_checkin_secrets s
     SET respawn_unlock_at = NULL,
         updated_at = now()
    FROM public.spartanops_checkins c
   WHERE c.id = s.checkin_id
     AND c.field_id = p_field_id;

  UPDATE public.spartanops_checkins
     SET death_count = 0,
         warning_message = NULL,
         team_changed_flag = false
   WHERE field_id = p_field_id;

  UPDATE public.spartanops_game_state
     SET status = 'lobby',
         match_started_at = NULL,
         team_scores = jsonb_build_object('modra', 0, 'rdeca', 0, 'rumena', 0),
         node_holders = jsonb_build_object('1', NULL, '2', NULL, '3', NULL, '4', NULL, '5', NULL),
         winner_team = NULL,
         updated_at = now()
   WHERE field_id = p_field_id;
END;
$function$;