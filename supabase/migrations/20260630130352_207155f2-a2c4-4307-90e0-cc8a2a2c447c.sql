
ALTER TABLE public.spartanops_game_state
  ADD COLUMN IF NOT EXISTS point_target integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS winner_team text;

CREATE OR REPLACE FUNCTION public.spartanops_apply_capture(p_field_id text, p_point integer, p_session_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_checkin public.spartanops_checkins%ROWTYPE;
  v_state public.spartanops_game_state%ROWTYPE;
  v_prev_holder text; v_scores jsonb; v_holders jsonb;
  v_new_score int; v_target int; v_new_status text; v_winner text;
BEGIN
  IF p_point NOT BETWEEN 1 AND 5 THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_point'); END IF;
  SELECT * INTO v_checkin FROM public.spartanops_checkins WHERE session_id = p_session_id AND field_id = p_field_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_checked_in'); END IF;
  IF v_checkin.assigned_team = 'none' THEN RETURN jsonb_build_object('ok', false, 'error', 'no_team'); END IF;
  SELECT * INTO v_state FROM public.spartanops_game_state WHERE field_id = p_field_id;
  IF v_state.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'error', 'match_not_active'); END IF;
  v_prev_holder := v_state.node_holders->>(p_point::text);
  IF v_prev_holder = v_checkin.assigned_team THEN RETURN jsonb_build_object('ok', true, 'already_held', true); END IF;
  v_holders := jsonb_set(v_state.node_holders, ARRAY[p_point::text], to_jsonb(v_checkin.assigned_team));
  v_new_score := COALESCE((v_state.team_scores->>v_checkin.assigned_team)::int, 0) + 1;
  v_scores := jsonb_set(v_state.team_scores, ARRAY[v_checkin.assigned_team], to_jsonb(v_new_score));
  v_target := COALESCE(v_state.point_target, 50);
  v_new_status := v_state.status;
  v_winner := v_state.winner_team;
  IF v_new_score >= v_target THEN
    v_new_status := 'ended';
    v_winner := v_checkin.assigned_team;
  END IF;
  UPDATE public.spartanops_game_state
     SET node_holders = v_holders, team_scores = v_scores,
         status = v_new_status, winner_team = v_winner, updated_at = now()
   WHERE field_id = p_field_id;
  INSERT INTO public.spartanops_captures (field_id, point_number, team, player_checkin_id, player_name, player_callsign)
  VALUES (p_field_id, p_point, v_checkin.assigned_team, v_checkin.id, v_checkin.name, v_checkin.callsign);
  RETURN jsonb_build_object('ok', true, 'team', v_checkin.assigned_team, 'ended', v_new_status = 'ended');
END;
$function$;
