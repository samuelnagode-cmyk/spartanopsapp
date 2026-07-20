
-- 1) Remove public read of PII on event_registrations
DROP POLICY IF EXISTS "Public read non-PII" ON public.event_registrations;

-- 2) Replace public read + delete on registrations with a safe public view
DROP POLICY IF EXISTS "Public read non-PII" ON public.registrations;
DROP POLICY IF EXISTS "Public can cancel registration" ON public.registrations;

CREATE OR REPLACE VIEW public.registrations_public
WITH (security_invoker = false) AS
SELECT id, event_id, event_title, callsign, gear_type, avatar, team_club, created_at
FROM public.registrations;

GRANT SELECT ON public.registrations_public TO anon, authenticated;

-- 3) Rename reset_token -> round_id (non-secret round identifier)
ALTER TABLE public.spartanops_match RENAME COLUMN reset_token TO round_id;
ALTER TABLE public.spartanops_players RENAME COLUMN reset_token TO round_id;
