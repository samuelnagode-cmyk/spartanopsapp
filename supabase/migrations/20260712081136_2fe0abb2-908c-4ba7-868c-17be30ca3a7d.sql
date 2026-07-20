
-- 1) Lobbies table — replaces the client-side spartanops.lobbies.v1 localStorage store.
CREATE TABLE public.spartanops_lobbies (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_name     text NOT NULL,
  event_name     text,
  location       text NOT NULL DEFAULT '',
  country        text,
  city           text,
  gamemode       text NOT NULL DEFAULT 'domination',
  map_url        text,
  match_duration_minutes integer NOT NULL DEFAULT 30,
  countdown_seconds      integer NOT NULL DEFAULT 60,
  point_target           integer NOT NULL DEFAULT 50,
  node_positions jsonb NOT NULL DEFAULT '{}'::jsonb,
  settings       jsonb NOT NULL DEFAULT '{}'::jsonb,
  password_hash          text NOT NULL,
  marshal_password_hash  text,
  published      boolean NOT NULL DEFAULT true,
  state          text NOT NULL DEFAULT 'pending',
  started_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- 2) GRANTs (Data API): public list read is safe (no secrets exposed via a view below),
--    but the raw table hides hashes from all clients.
GRANT SELECT ON public.spartanops_lobbies TO authenticated;
GRANT ALL    ON public.spartanops_lobbies TO service_role;

-- 3) RLS: nothing readable from raw table (hashes live here). All reads go through the public view.
ALTER TABLE public.spartanops_lobbies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no direct client read on lobbies"
  ON public.spartanops_lobbies FOR SELECT
  USING (false);

-- 4) Public view — safe columns only, invoker security so RLS above still blocks base table.
CREATE OR REPLACE VIEW public.spartanops_lobbies_public
WITH (security_invoker = on) AS
SELECT
  id, field_name, event_name, location, country, city,
  gamemode, map_url,
  match_duration_minutes, countdown_seconds, point_target,
  node_positions, settings,
  published, state, started_at,
  created_at, updated_at
FROM public.spartanops_lobbies
WHERE published = true;

GRANT SELECT ON public.spartanops_lobbies_public TO anon, authenticated;

-- 5) updated_at trigger (function already exists)
CREATE TRIGGER trg_spartanops_lobbies_updated_at
  BEFORE UPDATE ON public.spartanops_lobbies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Realtime publication for live roster + match state.
ALTER PUBLICATION supabase_realtime ADD TABLE public.spartanops_lobbies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.spartanops_checkins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.spartanops_game_state;

-- 7) Allow public sign-ups on spartanops_checkins for any lobby (self-registration via /join).
--    Existing policies keyed to legacy field ids remain intact; this widens INSERT to any UUID.
GRANT SELECT, INSERT, UPDATE ON public.spartanops_checkins TO anon, authenticated;
GRANT SELECT ON public.spartanops_game_state TO anon, authenticated;
GRANT ALL ON public.spartanops_checkins TO service_role;
GRANT ALL ON public.spartanops_game_state TO service_role;

-- Public check-in policies (session-based, no auth required for players)
DROP POLICY IF EXISTS "public can register into a lobby" ON public.spartanops_checkins;
CREATE POLICY "public can register into a lobby"
  ON public.spartanops_checkins FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "public can read roster" ON public.spartanops_checkins;
CREATE POLICY "public can read roster"
  ON public.spartanops_checkins FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "public can update own checkin" ON public.spartanops_checkins;
CREATE POLICY "public can update own checkin"
  ON public.spartanops_checkins FOR UPDATE
  TO anon, authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "public can read game state" ON public.spartanops_game_state;
CREATE POLICY "public can read game state"
  ON public.spartanops_game_state FOR SELECT
  TO anon, authenticated
  USING (true);

-- 8) Auto-provision a matching game_state row whenever a lobby is created.
CREATE OR REPLACE FUNCTION public.spartanops_bootstrap_game_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.spartanops_game_state (
    field_id, field_label, status, team_selection_open,
    current_polygon_name, compressed_map_url,
    countdown_seconds, match_duration_minutes,
    team_scores, node_holders, node_positions,
    point_target, gamemode, event_name, settings, updated_at
  )
  VALUES (
    NEW.id::text, NEW.field_name, 'lobby', true,
    NULL, NEW.map_url,
    NEW.countdown_seconds, NEW.match_duration_minutes,
    '{"modra":0,"rdeca":0,"rumena":0}'::jsonb,
    '{"1":null,"2":null,"3":null,"4":null,"5":null}'::jsonb,
    COALESCE(NEW.node_positions, '{}'::jsonb),
    NEW.point_target, NEW.gamemode, NEW.event_name,
    COALESCE(NEW.settings, '{}'::jsonb), now()
  )
  ON CONFLICT (field_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_spartanops_bootstrap_game_state
  AFTER INSERT ON public.spartanops_lobbies
  FOR EACH ROW EXECUTE FUNCTION public.spartanops_bootstrap_game_state();
