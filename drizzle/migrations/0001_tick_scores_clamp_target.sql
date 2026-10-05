CREATE OR REPLACE FUNCTION public.spartanops_tick_scores(p_field_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_state public.spartanops_game_state%ROWTYPE;
  v_base timestamptz; v_limit timestamptz; v_ticks int;
  v_scores jsonb; v_target int; v_team text; v_held int;
  v_winner text; v_status text; v_best int := -1;
  v_end_at timestamptz; v_expired boolean;
  v_target_hit boolean := false;
BEGIN
  SELECT * INTO v_state FROM public.spartanops_game_state WHERE field_id = p_field_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'no_state'); END IF;
  IF v_state.status <> 'active' OR v_state.match_started_at IS NULL OR v_state.match_started_at > now() THEN
    RETURN jsonb_build_object('ok', true, 'ticks', 0);
  END IF;

  v_end_at := v_state.match_started_at + make_interval(mins => COALESCE(v_state.match_duration_minutes, 40));
  v_expired := now() >= v_end_at;

  v_base := COALESCE(v_state.score_ticked_at, v_state.match_started_at);
  v_limit := LEAST(now(), v_end_at);
  v_ticks := FLOOR(EXTRACT(EPOCH FROM (v_limit - v_base)) / 30)::int;
  IF v_ticks IS NULL OR v_ticks <= 0 THEN
    IF v_expired THEN
      UPDATE public.spartanops_game_state
         SET status = 'ended',
             winner_team = public.spartanops_leader_team(team_scores),
             updated_at = now()
       WHERE field_id = p_field_id;
      RETURN jsonb_build_object('ok', true, 'ticks', 0, 'ended', true);
    END IF;
    RETURN jsonb_build_object('ok', true, 'ticks', 0);
  END IF;

  v_scores := COALESCE(v_state.team_scores, '{}'::jsonb);
  v_target := COALESCE(v_state.point_target, 50);
  v_status := v_state.status; v_winner := v_state.winner_team;

  FOR v_team IN SELECT jsonb_object_keys(v_scores) LOOP
    SELECT count(*) INTO v_held
      FROM jsonb_each_text(COALESCE(v_state.node_holders, '{}'::jsonb)) AS h(k, v)
     WHERE h.v = v_team;
    IF v_held > 0 THEN
      v_scores := jsonb_set(v_scores, ARRAY[v_team],
        to_jsonb(COALESCE((v_scores->>v_team)::int, 0) + v_held * v_ticks));
    END IF;
    IF COALESCE((v_scores->>v_team)::int, 0) > v_best THEN
      v_best := COALESCE((v_scores->>v_team)::int, 0);
      IF v_best >= v_target THEN v_winner := v_team; v_status := 'ended'; v_target_hit := true; END IF;
    END IF;
  END LOOP;

  -- Target win: cap stored scores at the target (winner already decided from uncapped scores).
  IF v_target_hit THEN
    SELECT COALESCE(jsonb_object_agg(k, LEAST(COALESCE(v::int, 0), v_target)), '{}'::jsonb)
      INTO v_scores
      FROM jsonb_each_text(v_scores) AS s(k, v);
  END IF;

  IF v_status = 'active' AND v_expired THEN
    v_status := 'ended';
    v_winner := public.spartanops_leader_team(v_scores);
  END IF;

  UPDATE public.spartanops_game_state
     SET team_scores = v_scores,
         score_ticked_at = v_base + make_interval(secs => v_ticks * 30),
         status = v_status, winner_team = v_winner, updated_at = now()
   WHERE field_id = p_field_id;

  RETURN jsonb_build_object('ok', true, 'ticks', v_ticks, 'ended', v_status = 'ended');
END;
$function$;