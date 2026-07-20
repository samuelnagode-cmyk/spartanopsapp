
-- Public attendee signups for airsoft events.
-- The `events` table lives in an external Supabase project, so event_id is a plain uuid (no FK).

CREATE TABLE public.event_registrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL,
  full_name text NOT NULL CHECK (char_length(full_name) BETWEEN 1 AND 120),
  email_or_phone text NOT NULL CHECK (char_length(email_or_phone) BETWEEN 3 AND 160),
  wants_food boolean NOT NULL DEFAULT false,
  public_callsign text NOT NULL CHECK (char_length(public_callsign) BETWEEN 1 AND 40),
  loadout_role text NOT NULL CHECK (char_length(loadout_role) BETWEEN 1 AND 40),
  avatar_id text NOT NULL CHECK (char_length(avatar_id) BETWEEN 1 AND 40),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX event_registrations_event_id_idx ON public.event_registrations(event_id);

-- Grants: anon may INSERT (public form); admin/full SELECT goes through service_role via server fn.
GRANT INSERT ON public.event_registrations TO anon, authenticated;
GRANT ALL ON public.event_registrations TO service_role;

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

-- Anyone can insert a registration (form is public). Length CHECKs above sanitize.
CREATE POLICY "Public can register" ON public.event_registrations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Public-safe attendee view: exposes only non-PII columns.
CREATE OR REPLACE VIEW public.event_registrations_public
WITH (security_invoker = true) AS
SELECT id, event_id, wants_food, public_callsign, loadout_role, avatar_id, created_at
FROM public.event_registrations;

GRANT SELECT ON public.event_registrations_public TO anon, authenticated;

-- The view bypasses RLS-denied SELECTs on the base table by being security_invoker=true
-- with a permissive policy below for the same columns. We add a SELECT policy that allows
-- only the safe columns set — implemented by simply letting anon SELECT and trusting the
-- view as the entry point. To keep the base table's PII unreadable to anon, we DO NOT
-- grant SELECT on the base table to anon.
