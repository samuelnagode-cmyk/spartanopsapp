ALTER TABLE public.spartanops_game_state ADD COLUMN IF NOT EXISTS score_ticked_at timestamptz;

-- Capture no longer awards an instant point; it only flips sector ownership.
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
  SELECT * INTO v_state FROM public.spartanops_game_state WHERE field_id = p_field_id;
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

-- Idempotent, timestamp-driven scoring tick: +1 point per held sector per 30s.
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
BEGIN
  SELECT * INTO v_state FROM public.spartanops_game_state WHERE field_id = p_field_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'no_state'); END IF;
  IF v_state.status <> 'active' OR v_state.match_started_at IS NULL OR v_state.match_started_at > now() THEN
    RETURN jsonb_build_object('ok', true, 'ticks', 0);
  END IF;

  v_base := COALESCE(v_state.score_ticked_at, v_state.match_started_at);
  v_limit := LEAST(now(), v_state.match_started_at + make_interval(mins => COALESCE(v_state.match_duration_minutes, 40)));
  v_ticks := FLOOR(EXTRACT(EPOCH FROM (v_limit - v_base)) / 30)::int;
  IF v_ticks IS NULL OR v_ticks <= 0 THEN RETURN jsonb_build_object('ok', true, 'ticks', 0); END IF;

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
      IF v_best >= v_target THEN v_winner := v_team; v_status := 'ended'; END IF;
    END IF;
  END LOOP;

  UPDATE public.spartanops_game_state
     SET team_scores = v_scores,
         score_ticked_at = v_base + make_interval(secs => v_ticks * 30),
         status = v_status, winner_team = v_winner, updated_at = now()
   WHERE field_id = p_field_id;

  RETURN jsonb_build_object('ok', true, 'ticks', v_ticks, 'ended', v_status = 'ended');
END;
$function$;

REVOKE ALL ON FUNCTION public.spartanops_tick_scores(text) FROM PUBLIC, anon, authenticated;