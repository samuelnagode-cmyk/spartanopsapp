
DROP VIEW IF EXISTS public.registrations_public;

CREATE VIEW public.registrations_public
WITH (security_invoker = on) AS
SELECT id, event_id, event_title, callsign, gear_type, avatar, team_club, created_at
FROM public.registrations;

GRANT SELECT ON public.registrations_public TO anon, authenticated;

-- Column-level grants: anon/authenticated can read only non-PII columns on the base table.
REVOKE SELECT ON public.registrations FROM anon, authenticated;
GRANT SELECT (id, event_id, event_title, callsign, gear_type, avatar, team_club, created_at)
  ON public.registrations TO anon, authenticated;

-- Re-add a SELECT policy (column-level grants enforce the PII boundary).
CREATE POLICY "Public read non-PII columns" ON public.registrations
  FOR SELECT TO anon, authenticated USING (true);
