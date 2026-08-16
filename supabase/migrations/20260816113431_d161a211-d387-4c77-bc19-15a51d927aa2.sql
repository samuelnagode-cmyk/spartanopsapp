CREATE TABLE IF NOT EXISTS public.spartanops_telemetry_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  dedupe_key text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.spartanops_telemetry_events TO service_role;
ALTER TABLE public.spartanops_telemetry_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "telemetry events service role only" ON public.spartanops_telemetry_events
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE INDEX IF NOT EXISTS idx_spartanops_telemetry_kind ON public.spartanops_telemetry_events (kind);