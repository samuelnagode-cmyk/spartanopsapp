
CREATE TABLE public.spartanops_match (
  id text PRIMARY KEY DEFAULT 'current',
  entry_code text NOT NULL DEFAULT 'OPS-1234',
  mode text,
  status text NOT NULL DEFAULT 'idle',
  target_points int NOT NULL DEFAULT 500,
  timer_value int NOT NULL DEFAULT 60,
  timer_unit text NOT NULL DEFAULT 'minutes',
  countdown_minutes int NOT NULL DEFAULT 2,
  started_at timestamptz,
  alfa_points int NOT NULL DEFAULT 0,
  bravo_points int NOT NULL DEFAULT 0,
  reset_token uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.spartanops_match TO anon, authenticated;
GRANT ALL ON public.spartanops_match TO service_role;

ALTER TABLE public.spartanops_match ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read match" ON public.spartanops_match FOR SELECT USING (true);
CREATE POLICY "Public update match" ON public.spartanops_match FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Public insert match" ON public.spartanops_match FOR INSERT WITH CHECK (true);

CREATE TRIGGER spartanops_match_updated_at
  BEFORE UPDATE ON public.spartanops_match
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.spartanops_match (id) VALUES ('current') ON CONFLICT (id) DO NOTHING;

CREATE TABLE public.spartanops_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_code text NOT NULL,
  reset_token uuid NOT NULL,
  callsign text NOT NULL,
  faction text NOT NULL,
  client_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reset_token, client_id)
);

GRANT SELECT, INSERT, DELETE ON public.spartanops_players TO anon, authenticated;
GRANT ALL ON public.spartanops_players TO service_role;

ALTER TABLE public.spartanops_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read players" ON public.spartanops_players FOR SELECT USING (true);
CREATE POLICY "Public insert players" ON public.spartanops_players FOR INSERT WITH CHECK (true);
CREATE POLICY "Public delete players" ON public.spartanops_players FOR DELETE USING (true);

ALTER PUBLICATION supabase_realtime ADD TABLE public.spartanops_match;
ALTER PUBLICATION supabase_realtime ADD TABLE public.spartanops_players;
