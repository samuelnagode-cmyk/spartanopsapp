
-- GDPR-safe registration: drop email/PII expectations, add first name + initial + experience level.
ALTER TABLE public.registrations
  ALTER COLUMN full_name DROP NOT NULL,
  ALTER COLUMN email_phone DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_initial text,
  ADD COLUMN IF NOT EXISTS experience_level text NOT NULL DEFAULT 'dobro'
    CHECK (experience_level IN ('slabo','dobro','zelo_dobro'));

-- New registrations are immediately public (no email/token confirmation flow).
ALTER TABLE public.registrations ALTER COLUMN is_confirmed SET DEFAULT true;

-- Rebuild the public roster view with the new columns.
DROP VIEW IF EXISTS public.registrations_public;
CREATE VIEW public.registrations_public
  WITH (security_invoker = true) AS
SELECT id, event_id, callsign, gear_type, avatar, team_club,
       first_name, last_initial, experience_level, created_at
FROM public.registrations
WHERE is_confirmed = true;
GRANT SELECT ON public.registrations_public TO anon, authenticated;

-- Cancelled events registry (public read, admin writes via service_role server fn).
CREATE TABLE IF NOT EXISTS public.event_cancellations (
  event_id text PRIMARY KEY,
  cancelled_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.event_cancellations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cancellations public read" ON public.event_cancellations;
CREATE POLICY "cancellations public read" ON public.event_cancellations
  FOR SELECT TO anon, authenticated USING (true);
GRANT SELECT ON public.event_cancellations TO anon, authenticated;
GRANT ALL ON public.event_cancellations TO service_role;
