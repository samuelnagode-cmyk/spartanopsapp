CREATE TABLE IF NOT EXISTS public.spartanops_match_results (
  id bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.spartanops_accounts(id) ON DELETE CASCADE,
  lobby_id uuid NOT NULL,
  mission_name text,
  gamemode text,
  match_started_at timestamptz NOT NULL,
  ended_at timestamptz NOT NULL DEFAULT now(),
  end_reason text NOT NULL CHECK (end_reason IN ('target','time','marshal','reset','cleanup','unknown')),
  played_seconds integer NOT NULL,
  duration_minutes integer,
  point_target integer,
  team_scores jsonb,
  winner_team text,
  players_in_match integer NOT NULL,
  player_key text NOT NULL,
  player_user_id uuid,
  callsign text NOT NULL,
  team text NOT NULL,
  team_won boolean NOT NULL DEFAULT false,
  captures integer NOT NULL DEFAULT 0,
  deaths integer NOT NULL DEFAULT 0,
  is_mvp boolean NOT NULL DEFAULT false,
  UNIQUE (lobby_id, match_started_at, player_key)
);
CREATE INDEX IF NOT EXISTS spartanops_match_results_account_idx ON public.spartanops_match_results (account_id, ended_at DESC);
CREATE INDEX IF NOT EXISTS spartanops_match_results_player_idx ON public.spartanops_match_results (player_key);
ALTER TABLE public.spartanops_match_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spartanops_match_results FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.spartanops_match_results TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.spartanops_match_results_id_seq TO service_role;

CREATE OR REPLACE FUNCTION public.spartanops_leader_team(p_scores jsonb) RETURNS text
LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE r record; best int := 0; leader text := NULL; n int := 0;
BEGIN
  FOR r IN SELECT key, COALESCE(value::text::numeric, 0)::int AS v FROM jsonb_each(COALESCE(p_scores, '{}'::jsonb)) LOOP
    IF r.v > best THEN best := r.v; leader := r.key; n := 1;
    ELSIF r.v = best AND r.v > 0 THEN n := n + 1;
    END IF;
  END LOOP;
  IF n = 1 THEN RETURN leader; END IF;
  RETURN NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.spartanops_record_results(p_field_id text, p_reason text DEFAULT 'auto')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
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
    NULL,
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
$$;

CREATE OR REPLACE FUNCTION public.spartanops_record_results_safe(p_field_id text, p_reason text DEFAULT 'auto')
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
BEGIN
  RETURN public.spartanops_record_results(p_field_id, p_reason);
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'spartanops_record_results failed for %: %', p_field_id, SQLERRM;
  RETURN 0;
END; $$;

REVOKE ALL ON FUNCTION public.spartanops_leader_team(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.spartanops_record_results(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.spartanops_record_results_safe(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spartanops_leader_team(jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.spartanops_record_results(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.spartanops_record_results_safe(text, text) TO service_role;

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
      IF v_best >= v_target THEN v_winner := v_team; v_status := 'ended'; END IF;
    END IF;
  END LOOP;

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

CREATE OR REPLACE FUNCTION public.spartanops_record_results_on_end()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.status = 'ended' AND OLD.status IS DISTINCT FROM 'ended' THEN
    PERFORM public.spartanops_record_results_safe(NEW.field_id, 'auto');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_spartanops_record_results_on_end ON public.spartanops_game_state;
CREATE TRIGGER trg_spartanops_record_results_on_end
  AFTER UPDATE ON public.spartanops_game_state
  FOR EACH ROW
  EXECUTE FUNCTION public.spartanops_record_results_on_end();

REVOKE ALL ON FUNCTION public.spartanops_record_results_on_end() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spartanops_record_results_on_end() TO service_role;

CREATE OR REPLACE FUNCTION public.spartanops_reset_match_runtime(p_field_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '60s'
AS $function$
BEGIN
  PERFORM public.spartanops_record_results_safe(p_field_id, 'reset');
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

CREATE OR REPLACE FUNCTION public.spartanops_delete_lobby_players(p_lobby_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '60s'
AS $function$
BEGIN
  PERFORM public.spartanops_record_results_safe(p_lobby_id, 'cleanup');
  DELETE FROM public.spartanops_captures WHERE field_id = p_lobby_id;
  DELETE FROM public.spartanops_checkins WHERE field_id = p_lobby_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.spartanops_delete_lobby(p_lobby_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET statement_timeout TO '90s'
AS $function$
DECLARE
  v_text_id text := p_lobby_id::text;
BEGIN
  PERFORM public.spartanops_record_results_safe(p_lobby_id::text, 'cleanup');
  INSERT INTO public.spartanops_archived_missions (
    lobby_id, field_name, event_name, location, city, country, gamemode, map_url,
    match_duration_minutes, countdown_seconds, point_target, node_positions, settings,
    final_scores, winner_team, mission_state, started_at, lobby_created_at,
    decommissioned_at, player_count, capture_count, updated_at
  )
  SELECT
    l.id, l.field_name,
    COALESCE(NULLIF(l.settings->>'missionName', ''), l.event_name),
    l.location, l.city, l.country, l.gamemode, l.map_url,
    l.match_duration_minutes, l.countdown_seconds, l.point_target,
    COALESCE(l.node_positions, '{}'::jsonb), COALESCE(l.settings, '{}'::jsonb),
    COALESCE(gs.team_scores, '{}'::jsonb), gs.winner_team,
    COALESCE(gs.status, l.state), l.started_at, l.created_at, now(),
    (SELECT count(*)::integer FROM public.spartanops_checkins c WHERE c.field_id = v_text_id),
    (SELECT count(*)::integer FROM public.spartanops_captures cap WHERE cap.field_id = v_text_id),
    now()
  FROM public.spartanops_lobbies l
  LEFT JOIN public.spartanops_game_state gs ON gs.field_id = v_text_id
  WHERE l.id = p_lobby_id
  ON CONFLICT (lobby_id) DO UPDATE SET
    field_name = EXCLUDED.field_name, event_name = EXCLUDED.event_name,
    location = EXCLUDED.location, city = EXCLUDED.city, country = EXCLUDED.country,
    gamemode = EXCLUDED.gamemode, map_url = EXCLUDED.map_url,
    match_duration_minutes = EXCLUDED.match_duration_minutes,
    countdown_seconds = EXCLUDED.countdown_seconds, point_target = EXCLUDED.point_target,
    node_positions = EXCLUDED.node_positions, settings = EXCLUDED.settings,
    final_scores = EXCLUDED.final_scores, winner_team = EXCLUDED.winner_team,
    mission_state = EXCLUDED.mission_state, started_at = EXCLUDED.started_at,
    lobby_created_at = EXCLUDED.lobby_created_at, decommissioned_at = EXCLUDED.decommissioned_at,
    player_count = EXCLUDED.player_count, capture_count = EXCLUDED.capture_count,
    updated_at = now();

  DELETE FROM public.spartanops_qr_anchors WHERE field_id = v_text_id;
  DELETE FROM public.spartanops_captures WHERE field_id = v_text_id;
  DELETE FROM public.spartanops_checkin_secrets s
   USING public.spartanops_checkins c
   WHERE s.checkin_id = c.id AND c.field_id = v_text_id;
  DELETE FROM public.spartanops_checkins WHERE field_id = v_text_id;
  DELETE FROM public.spartanops_game_state WHERE field_id = v_text_id OR id = v_text_id;
  DELETE FROM public.spartanops_lobbies WHERE id = p_lobby_id;
END;
$function$;