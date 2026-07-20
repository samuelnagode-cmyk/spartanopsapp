
-- Add confirmation/cancellation/marketing fields
ALTER TABLE public.registrations
  ADD COLUMN email text,
  ADD COLUMN is_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN confirmed_at timestamptz,
  ADD COLUMN confirmation_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN cancel_token uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN marketing_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN event_end timestamptz;

-- Make callsign nullable (was required before)
ALTER TABLE public.registrations ALTER COLUMN callsign DROP NOT NULL;

CREATE UNIQUE INDEX registrations_confirmation_token_idx ON public.registrations(confirmation_token);
CREATE UNIQUE INDEX registrations_cancel_token_idx ON public.registrations(cancel_token);
CREATE INDEX registrations_event_id_confirmed_idx ON public.registrations(event_id, is_confirmed);

-- Rebuild public view: only confirmed attendees, no PII
DROP VIEW IF EXISTS public.registrations_public;
CREATE VIEW public.registrations_public
WITH (security_invoker = off) AS
SELECT id, event_id, event_title, full_name, callsign, meal, team_club, gear_type, avatar, created_at
FROM public.registrations
WHERE is_confirmed = true;

GRANT SELECT ON public.registrations_public TO anon, authenticated;

-- Marketing subscribers (for opt-ins retained after GDPR sweep)
CREATE TABLE public.marketing_subscribers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  source text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.marketing_subscribers TO authenticated;
GRANT ALL ON public.marketing_subscribers TO service_role;
ALTER TABLE public.marketing_subscribers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages subscribers"
  ON public.marketing_subscribers FOR ALL
  TO service_role USING (true) WITH CHECK (true);
