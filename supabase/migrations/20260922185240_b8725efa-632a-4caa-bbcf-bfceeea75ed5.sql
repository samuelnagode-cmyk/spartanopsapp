CREATE OR REPLACE FUNCTION public.spartanops_approve_suspicious_capture(p_capture_id uuid, p_field_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cap public.spartanops_captures%ROWTYPE;
  v_state public.spartanops_game_state%ROWTYPE;
  v_scores jsonb; v_holders jsonb; v_team text; v_point text;
  v_target int; v_winner text; v_status text;
BEGIN
  SELECT * INTO v_cap FROM public.spartanops_captures
   WHERE id = p_capture_id AND field_id = p_field_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'capture_not_found');
  END IF;

  SELECT * INTO v_state FROM public.spartanops_game_state
   WHERE field_id = p_field_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no_state');
  END IF;

  v_scores := COALESCE(v_state.team_scores, '{}'::jsonb);
  v_holders := COALESCE(v_state.node_holders, '{}'::jsonb);
  v_team := v_cap.team;
  v_point := v_cap.point_number::text;

  IF (v_holders->>v_point) IS DISTINCT FROM v_team THEN
    v_holders := jsonb_set(v_holders, ARRAY[v_point], to_jsonb(v_team));
    v_scores := jsonb_set(v_scores, ARRAY[v_team], to_jsonb(COALESCE((v_scores->>v_team)::int, 0) + 1));
  END IF;

  v_target := COALESCE(v_state.point_target, 50);
  v_winner := v_state.winner_team;
  v_status := v_state.status;
  IF COALESCE((v_scores->>v_team)::int, 0) >= v_target THEN
    v_winner := v_team;
    v_status := 'ended';
  END IF;

  UPDATE public.spartanops_game_state
     SET team_scores = v_scores, node_holders = v_holders,
         winner_team = v_winner, status = v_status, updated_at = now()
   WHERE field_id = p_field_id;

  UPDATE public.spartanops_captures
     SET suspicious = false, spartacus_status = 'approved'
   WHERE id = p_capture_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.spartanops_approve_suspicious_capture(uuid, text) FROM anon, authenticated, public;
