-- Surgical fix: row-lock the game state read in spartanops_apply_capture
-- to prevent lost updates when two players capture different sectors
-- concurrently. Mirrors the FOR UPDATE pattern already used by
-- spartanops_tick_scores. No other lines, functions, policies or grants change.

CREATE OR REPLACE FUNCTION public.spartanops_apply_capture(p_field_id text, p_point integer, p_session_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_checkin public.spartanops_checkins%ROWTYPE;
  v_state public.spartanops_game_state%ROWTYPE;
  v_prev_holder text; v_holders jsonb;
BEGIN
  IF p_point NOT BETWEEN 1 AND 5 THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_point'); END IF;
  SELECT c.* INTO v_checkin
    FROM public.spartanops_checkins c
    JOIN public.spartanops_checkin_secrets s ON s.checkin_id = c.id
   WHERE s.session_id = p_session_id AND c.field_id = p_field_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_checked_in'); END IF;
  IF v_checkin.assigned_team = 'none' THEN RETURN jsonb_build_object('ok', false, 'error', 'no_team'); END IF;
  SELECT * INTO v_state FROM public.spartanops_game_state WHERE field_id = p_field_id FOR UPDATE;
  IF v_state.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'error', 'match_not_active'); END IF;
  IF v_state.match_started_at IS NULL OR v_state.match_started_at > now() THEN RETURN jsonb_build_object('ok', false, 'error', 'pre_start_locked'); END IF;
  v_prev_holder := v_state.node_holders->>(p_point::text);
  IF v_prev_holder = v_checkin.assigned_team THEN RETURN jsonb_build_object('ok', true, 'already_held', true); END IF;
  v_holders := jsonb_set(v_state.node_holders, ARRAY[p_point::text], to_jsonb(v_checkin.assigned_team));
  UPDATE public.spartanops_game_state
     SET node_holders = v_holders, updated_at = now()
   WHERE field_id = p_field_id;
  INSERT INTO public.spartanops_captures (field_id, point_number, team, player_checkin_id, player_callsign)
  VALUES (p_field_id, p_point, v_checkin.assigned_team, v_checkin.id, v_checkin.callsign);
  RETURN jsonb_build_object('ok', true, 'team', v_checkin.assigned_team, 'ended', false);
END;
$function$;