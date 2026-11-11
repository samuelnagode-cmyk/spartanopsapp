CREATE TABLE public.spartanops_death_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  field_id text NOT NULL,
  checkin_id uuid NOT NULL REFERENCES public.spartanops_checkins(id) ON DELETE CASCADE,
  callsign text NOT NULL,
  team text NOT NULL,
  died_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX spartanops_death_events_field_died_idx ON public.spartanops_death_events (field_id, died_at DESC);
REVOKE ALL ON public.spartanops_death_events FROM anon, authenticated;
GRANT ALL ON public.spartanops_death_events TO service_role;
ALTER TABLE public.spartanops_death_events ENABLE ROW LEVEL SECURITY;