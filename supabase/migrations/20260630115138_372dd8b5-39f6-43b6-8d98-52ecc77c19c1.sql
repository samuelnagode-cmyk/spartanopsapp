
-- Drop legacy
DROP TABLE IF EXISTS public.spartanops_players CASCADE;
DROP TABLE IF EXISTS public.spartanops_match CASCADE;

-- Game state (singleton row, id = 'current')
CREATE TABLE public.spartanops_game_state (
  id text PRIMARY KEY DEFAULT 'current',
  status text NOT NULL DEFAULT 'closed' CHECK (status IN ('closed','lobby','active')),
  team_selection_open boolean NOT NULL DEFAULT false,
  current_polygon_name text,
  compressed_map_url text,
  countdown_seconds integer NOT NULL DEFAULT 10,
  match_started_at timestamptz,
  match_duration_minutes integer NOT NULL DEFAULT 20,
  team_scores jsonb NOT NULL DEFAULT '{"modra":0,"rdeca":0,"rumena":0}'::jsonb,
  node_holders jsonb NOT NULL DEFAULT '{"1":null,"2":null,"3":null,"4":null,"5":null}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.spartanops_game_state TO anon, authenticated;
GRANT ALL ON public.spartanops_game_state TO service_role;
ALTER TABLE public.spartanops_game_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_state public read" ON public.spartanops_game_state FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.spartanops_game_state (id) VALUES ('current') ON CONFLICT DO NOTHING;

-- Checkins
CREATE TABLE public.spartanops_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL UNIQUE,
  name text NOT NULL,
  callsign text,
  club text,
  experience_level text NOT NULL DEFAULT 'dobro' CHECK (experience_level IN ('slabo','dobro','zelo_dobro')),
  assigned_team text NOT NULL DEFAULT 'none' CHECK (assigned_team IN ('none','modra','rdeca','rumena')),
  team_changed_flag boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.spartanops_checkins TO anon, authenticated;
GRANT ALL ON public.spartanops_checkins TO service_role;
ALTER TABLE public.spartanops_checkins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "checkins public read" ON public.spartanops_checkins FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "checkins public insert" ON public.spartanops_checkins FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Captures
CREATE TABLE public.spartanops_captures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  point_number integer NOT NULL CHECK (point_number BETWEEN 1 AND 5),
  team text NOT NULL CHECK (team IN ('modra','rdeca','rumena')),
  player_checkin_id uuid REFERENCES public.spartanops_checkins(id) ON DELETE SET NULL,
  player_name text,
  player_callsign text,
  captured_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.spartanops_captures TO anon, authenticated;
GRANT ALL ON public.spartanops_captures TO service_role;
ALTER TABLE public.spartanops_captures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "captures public read" ON public.spartanops_captures FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "captures public insert" ON public.spartanops_captures FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.spartanops_game_state;
ALTER PUBLICATION supabase_realtime ADD TABLE public.spartanops_checkins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.spartanops_captures;
