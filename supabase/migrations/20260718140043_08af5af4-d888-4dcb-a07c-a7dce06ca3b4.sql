CREATE TABLE IF NOT EXISTS public.spartanops_archived_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id uuid NOT NULL UNIQUE,
  field_name text NOT NULL,
  event_name text,
  location text,
  city text,
  country text,
  gamemode text,
  map_url text,
  match_duration_minutes integer,
  countdown_seconds integer,
  point_target integer,
  node_positions jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  final_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  winner_team text,
  mission_state text,
  started_at timestamptz,
  lobby_created_at timestamptz,
  decommissioned_at timestamptz NOT NULL DEFAULT now(),
  player_count integer NOT NULL DEFAULT 0,
  capture_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.spartanops_archived_missions TO anon;
GRANT SELECT ON public.spartanops_archived_missions TO authenticated;
GRANT ALL ON public.spartanops_archived_missions TO service_role;

ALTER TABLE public.spartanops_archived_missions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Archived missions are publicly readable" ON public.spartanops_archived_missions;
CREATE POLICY "Archived missions are publicly readable"
ON public.spartanops_archived_missions
FOR SELECT
TO anon, authenticated
USING (true);

CREATE OR REPLACE FUNCTION public.spartanops_delete_lobby(p_lobby_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_text_id text := p_lobby_id::text;
BEGIN
  -- Archive a non-sensitive mission snapshot before removing live operational rows.
  INSERT INTO public.spartanops_archived_missions (
    lobby_id,
    field_name,
    event_name,
    location,
    city,
    country,
    gamemode,
    map_url,
    match_duration_minutes,
    countdown_seconds,
    point_target,
    node_positions,
    settings,
    final_scores,
    winner_team,
    mission_state,
    started_at,
    lobby_created_at,
    decommissioned_at,
    player_count,
    capture_count,
    updated_at
  )
  SELECT
    l.id,
    l.field_name,
    COALESCE(NULLIF(l.settings->>'missionName', ''), l.event_name),
    l.location,
    l.city,
    l.country,
    l.gamemode,
    l.map_url,
    l.match_duration_minutes,
    l.countdown_seconds,
    l.point_target,
    COALESCE(l.node_positions, '{}'::jsonb),
    COALESCE(l.settings, '{}'::jsonb),
    COALESCE(gs.team_scores, '{}'::jsonb),
    gs.winner_team,
    COALESCE(gs.status, l.state),
    l.started_at,
    l.created_at,
    now(),
    (SELECT count(*)::integer FROM public.spartanops_checkins c WHERE c.field_id = v_text_id),
    (SELECT count(*)::integer FROM public.spartanops_captures cap WHERE cap.field_id = v_text_id),
    now()
  FROM public.spartanops_lobbies l
  LEFT JOIN public.spartanops_game_state gs ON gs.field_id = v_text_id
  WHERE l.id = p_lobby_id
  ON CONFLICT (lobby_id) DO UPDATE SET
    field_name = EXCLUDED.field_name,
    event_name = EXCLUDED.event_name,
    location = EXCLUDED.location,
    city = EXCLUDED.city,
    country = EXCLUDED.country,
    gamemode = EXCLUDED.gamemode,
    map_url = EXCLUDED.map_url,
    match_duration_minutes = EXCLUDED.match_duration_minutes,
    countdown_seconds = EXCLUDED.countdown_seconds,
    point_target = EXCLUDED.point_target,
    node_positions = EXCLUDED.node_positions,
    settings = EXCLUDED.settings,
    final_scores = EXCLUDED.final_scores,
    winner_team = EXCLUDED.winner_team,
    mission_state = EXCLUDED.mission_state,
    started_at = EXCLUDED.started_at,
    lobby_created_at = EXCLUDED.lobby_created_at,
    decommissioned_at = EXCLUDED.decommissioned_at,
    player_count = EXCLUDED.player_count,
    capture_count = EXCLUDED.capture_count,
    updated_at = now();

  -- Strict decommission order. Realtime DELETEs on game_state require
  -- replica identity because this table is published for live updates.
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