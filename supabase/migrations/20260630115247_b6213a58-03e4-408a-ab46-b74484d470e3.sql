
CREATE OR REPLACE FUNCTION public.spartanops_acknowledge_team_change(p_session_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.spartanops_checkins SET team_changed_flag = false WHERE session_id = p_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.spartanops_acknowledge_team_change(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.spartanops_apply_capture(p_point integer, p_session_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_checkin public.spartanops_checkins%ROWTYPE;
  v_state public.spartanops_game_state%ROWTYPE;
  v_prev_holder text;
  v_scores jsonb;
  v_holders jsonb;
BEGIN
  IF p_point NOT BETWEEN 1 AND 5 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_point');
  END IF;

  SELECT * INTO v_checkin FROM public.spartanops_checkins WHERE session_id = p_session_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_checked_in'); END IF;
  IF v_checkin.assigned_team = 'none' THEN RETURN jsonb_build_object('ok', false, 'error', 'no_team'); END IF;

  SELECT * INTO v_state FROM public.spartanops_game_state WHERE id = 'current';
  IF v_state.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'error', 'match_not_active'); END IF;

  v_prev_holder := v_state.node_holders->>(p_point::text);
  IF v_prev_holder = v_checkin.assigned_team THEN
    RETURN jsonb_build_object('ok', true, 'already_held', true);
  END IF;

  v_holders := jsonb_set(v_state.node_holders, ARRAY[p_point::text], to_jsonb(v_checkin.assigned_team));
  v_scores := jsonb_set(
    v_state.team_scores,
    ARRAY[v_checkin.assigned_team],
    to_jsonb(COALESCE((v_state.team_scores->>v_checkin.assigned_team)::int, 0) + 1)
  );

  UPDATE public.spartanops_game_state
  SET node_holders = v_holders, team_scores = v_scores, updated_at = now()
  WHERE id = 'current';

  INSERT INTO public.spartanops_captures (point_number, team, player_checkin_id, player_name, player_callsign)
  VALUES (p_point, v_checkin.assigned_team, v_checkin.id, v_checkin.name, v_checkin.callsign);

  RETURN jsonb_build_object('ok', true, 'team', v_checkin.assigned_team);
END;
$$;

GRANT EXECUTE ON FUNCTION public.spartanops_apply_capture(integer, text) TO anon, authenticated;
