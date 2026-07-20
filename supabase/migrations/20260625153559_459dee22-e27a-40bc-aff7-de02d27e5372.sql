
-- Remove public SELECT on registrations (PII exposure). Public reads go through registrations_public view.
DROP POLICY IF EXISTS "Public read non-PII columns" ON public.registrations;

-- Explicitly block DELETE on registrations for anon/authenticated (no policy = denied, but make intent explicit by revoking the privilege).
REVOKE DELETE ON public.registrations FROM anon, authenticated;
REVOKE DELETE ON public.event_registrations FROM anon, authenticated;

-- Tighten spartanops permissive RLS: replace USING(true)/WITH CHECK(true) on UPDATE/DELETE/INSERT
-- with policies that still allow the public game flow but are not unconditionally true.
-- spartanops_players: allow insert/update/delete only when round matches the current match round.
DROP POLICY IF EXISTS "Public insert players" ON public.spartanops_players;
DROP POLICY IF EXISTS "Public update players" ON public.spartanops_players;
DROP POLICY IF EXISTS "Public delete players" ON public.spartanops_players;

CREATE POLICY "Players insert in active round"
  ON public.spartanops_players FOR INSERT TO anon, authenticated
  WITH CHECK (round_id IN (SELECT round_id FROM public.spartanops_match WHERE id = 'current'));

CREATE POLICY "Players update in active round"
  ON public.spartanops_players FOR UPDATE TO anon, authenticated
  USING (round_id IN (SELECT round_id FROM public.spartanops_match WHERE id = 'current'))
  WITH CHECK (round_id IN (SELECT round_id FROM public.spartanops_match WHERE id = 'current'));

CREATE POLICY "Players delete in active round"
  ON public.spartanops_players FOR DELETE TO anon, authenticated
  USING (round_id IN (SELECT round_id FROM public.spartanops_match WHERE id = 'current'));

-- spartanops_match: singleton row id='current'. Restrict UPDATE/INSERT to that row instead of unconditional true.
DROP POLICY IF EXISTS "Public insert match" ON public.spartanops_match;
DROP POLICY IF EXISTS "Public update match" ON public.spartanops_match;

CREATE POLICY "Match insert singleton"
  ON public.spartanops_match FOR INSERT TO anon, authenticated
  WITH CHECK (id = 'current');

CREATE POLICY "Match update singleton"
  ON public.spartanops_match FOR UPDATE TO anon, authenticated
  USING (id = 'current')
  WITH CHECK (id = 'current');
