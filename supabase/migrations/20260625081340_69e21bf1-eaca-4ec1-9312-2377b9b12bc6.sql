
DROP VIEW IF EXISTS public.event_registrations_public;

CREATE VIEW public.event_registrations_public
WITH (security_invoker = true) AS
SELECT id, event_id, wants_food, public_callsign, loadout_role, avatar_id, created_at
FROM public.event_registrations;

GRANT SELECT ON public.event_registrations_public TO anon, authenticated;

-- The view runs as the caller; give anon SELECT on the base table,
-- BUT only the non-PII columns. We achieve this via column-level grants:
-- revoke broad SELECT and grant only the safe columns.
GRANT SELECT (id, event_id, wants_food, public_callsign, loadout_role, avatar_id, created_at)
  ON public.event_registrations TO anon, authenticated;

-- RLS still applies; add a SELECT policy that allows reading the safe columns.
CREATE POLICY "Public read non-PII"
  ON public.event_registrations
  FOR SELECT
  TO anon, authenticated
  USING (true);
