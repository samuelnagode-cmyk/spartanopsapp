ALTER TABLE public.spartanops_players
  ADD COLUMN link_games boolean NOT NULL DEFAULT true;

ALTER TABLE public.spartanops_checkin_secrets
  ADD COLUMN user_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS spartanops_checkin_secrets_user_idx
  ON public.spartanops_checkin_secrets (user_id) WHERE user_id IS NOT NULL;

ALTER TABLE public.spartanops_match_results
  ADD CONSTRAINT spartanops_match_results_player_user_fk
  FOREIGN KEY (player_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS spartanops_match_results_user_idx
  ON public.spartanops_match_results (player_user_id, ended_at DESC) WHERE player_user_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.spartanops_record_results(p_field_id text, p_reason text DEFAULT 'auto'::text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_state public.spartanops_game_state%ROWTYPE;
  v_lobby public.spartanops_lobbies%ROWTYPE;
  v_reason text;
  v_winner text;
  v_inserted integer := 0;
BEGIN
  IF p_field_id IS NULL OR p_field_id !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    RETURN 0;
  END IF;
  SELECT * INTO v_state FROM public.spartanops_game_state WHERE field_id = p_field_id;
  IF NOT FOUND OR v_state.match_started_at IS NULL OR v_state.match_started_at > now() THEN
    RETURN 0;
  END IF;
  SELECT * INTO v_lobby FROM public.spartanops_lobbies WHERE id = p_field_id::uuid;
  IF NOT FOUND OR v_lobby.account_id IS NULL THEN
    RETURN 0;
  END IF;

  IF p_reason = 'auto' THEN
    IF COALESCE((SELECT max(COALESCE(value::text::numeric, 0)::int) FROM jsonb_each(COALESCE(v_state.team_scores, '{}'::jsonb))), 0) >= COALESCE(v_state.point_target, 50) THEN
      v_reason := 'target';
    ELSIF now() >= v_state.match_started_at + make_interval(mins => COALESCE(v_state.match_duration_minutes, 40)) THEN
      v_reason := 'time';
    ELSE
      v_reason := 'marshal';
    END IF;
  ELSE
    v_reason := p_reason;
  END IF;

  v_winner := v_state.winner_team;

  WITH players AS (
    SELECT c.id AS checkin_id,
           c.callsign,
           c.assigned_team,
           COALESCE(c.death_count, 0) AS deaths,
           COALESCE(encode(extensions.digest(s.session_id, 'sha256'), 'hex'), c.id::text) AS player_key,
           s.user_id AS player_user_id,
           (SELECT count(*)::int FROM public.spartanops_captures cap
             WHERE cap.field_id = p_field_id
               AND cap.player_checkin_id = c.id
               AND COALESCE(cap.suspicious, false) = false) AS captures
      FROM public.spartanops_checkins c
      LEFT JOIN public.spartanops_checkin_secrets s ON s.checkin_id = c.id
     WHERE c.field_id = p_field_id
       AND c.assigned_team <> 'none'
  )
  INSERT INTO public.spartanops_match_results (
    account_id, lobby_id, mission_name, gamemode,
    match_started_at, ended_at, end_reason, played_seconds,
    duration_minutes, point_target, team_scores, winner_team,
    players_in_match, player_key, player_user_id,
    callsign, team, team_won, captures, deaths, is_mvp
  )
  SELECT
    v_lobby.account_id,
    v_lobby.id,
    COALESCE(NULLIF(v_lobby.event_name, ''), v_lobby.field_name),
    v_lobby.gamemode,
    v_state.match_started_at,
    now(),
    v_reason,
    GREATEST(0, EXTRACT(EPOCH FROM (now() - v_state.match_started_at))::int),
    v_state.match_duration_minutes,
    v_state.point_target,
    v_state.team_scores,
    v_winner,
    (SELECT count(*)::int FROM players),
    p.player_key,
    p.player_user_id,
    p.callsign,
    p.assigned_team,
    (v_winner IS NOT NULL AND p.assigned_team = v_winner),
    p.captures,
    p.deaths,
    (p.captures > 0 AND p.captures = (
       SELECT max(g.captures) FROM players g
        WHERE (v_winner IS NULL) OR (g.assigned_team = v_winner)
     ) AND ((v_winner IS NULL) OR (p.assigned_team = v_winner)))
  FROM players p
  ON CONFLICT (lobby_id, match_started_at, player_key) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  RETURN v_inserted;
END;
$function$;