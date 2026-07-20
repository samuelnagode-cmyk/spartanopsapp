
CREATE TABLE public.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text,
  event_title text NOT NULL,
  full_name text NOT NULL,
  email_phone text NOT NULL,
  meal text NOT NULL,
  callsign text NOT NULL,
  team_club text,
  gear_type text NOT NULL,
  avatar text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.registrations TO anon, authenticated;
GRANT ALL ON public.registrations TO service_role;

ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can register" ON public.registrations
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "Public read non-PII" ON public.registrations
  FOR SELECT TO anon, authenticated USING (true);
