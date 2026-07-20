
-- Checkins: remove duplicate + permissive insert, add scoped insert
DROP POLICY IF EXISTS "public can register into a lobby" ON public.spartanops_checkins;
DROP POLICY IF EXISTS "checkins public insert" ON public.spartanops_checkins;

CREATE POLICY "checkins scoped insert"
ON public.spartanops_checkins
FOR INSERT
TO anon, authenticated
WITH CHECK (
  field_id IS NOT NULL
  AND callsign IS NOT NULL
  AND length(callsign) BETWEEN 1 AND 50
  AND EXISTS (
    SELECT 1 FROM public.spartanops_lobbies l
    WHERE l.id::text = spartanops_checkins.field_id
  )
  AND EXISTS (
    SELECT 1 FROM public.spartanops_game_state g
    WHERE g.field_id = spartanops_checkins.field_id
      AND g.status IN ('lobby','pre_match','active','paused')
  )
);

-- Checkins: scope read to currently-running fields only
DROP POLICY IF EXISTS "checkins roster read" ON public.spartanops_checkins;

CREATE POLICY "checkins scoped read"
ON public.spartanops_checkins
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.spartanops_game_state g
    WHERE g.field_id = spartanops_checkins.field_id
      AND g.status IN ('lobby','pre_match','active','paused')
  )
);

-- Captures: scope read to currently-running fields only
DROP POLICY IF EXISTS "captures public read" ON public.spartanops_captures;

CREATE POLICY "captures scoped read"
ON public.spartanops_captures
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.spartanops_game_state g
    WHERE g.field_id = spartanops_captures.field_id
      AND g.status IN ('lobby','pre_match','active','paused')
  )
);
