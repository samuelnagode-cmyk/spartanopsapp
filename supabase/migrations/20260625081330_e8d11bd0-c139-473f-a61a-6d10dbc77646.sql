
-- Recreate view in security-definer mode so anon can read it without needing
-- SELECT on the base table (which holds PII).
DROP VIEW IF EXISTS public.event_registrations_public;

CREATE VIEW public.event_registrations_public AS
SELECT id, event_id, wants_food, public_callsign, loadout_role, avatar_id, created_at
FROM public.event_registrations;

GRANT SELECT ON public.event_registrations_public TO anon, authenticated;

COMMENT ON POLICY "Public can register" ON public.event_registrations IS
  'Intentional: airsoft signup form is public. Length CHECK constraints sanitize input. Service-role server fn handles admin reads.';
