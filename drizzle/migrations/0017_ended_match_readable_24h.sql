DROP POLICY IF EXISTS "game state scoped read" ON public.spartanops_game_state;
CREATE POLICY "game state scoped read" ON public.spartanops_game_state
FOR SELECT TO public USING (
  status = ANY (ARRAY['lobby'::text,'pre_match'::text,'active'::text,'paused'::text])
  OR (status = 'ended' AND updated_at > now() - interval '24 hours')
);
DROP POLICY IF EXISTS "checkins scoped read" ON public.spartanops_checkins;
CREATE POLICY "checkins scoped read" ON public.spartanops_checkins
FOR SELECT TO anon, authenticated USING (
  EXISTS (SELECT 1 FROM public.spartanops_game_state g
    WHERE g.field_id = spartanops_checkins.field_id
      AND (g.status = ANY (ARRAY['lobby'::text,'pre_match'::text,'active'::text,'paused'::text])
           OR (g.status = 'ended' AND g.updated_at > now() - interval '24 hours')))
);
DROP POLICY IF EXISTS "captures scoped read" ON public.spartanops_captures;
CREATE POLICY "captures scoped read" ON public.spartanops_captures
FOR SELECT TO anon, authenticated USING (
  EXISTS (SELECT 1 FROM public.spartanops_game_state g
    WHERE g.field_id = spartanops_captures.field_id
      AND (g.status = ANY (ARRAY['lobby'::text,'pre_match'::text,'active'::text,'paused'::text])
           OR (g.status = 'ended' AND g.updated_at > now() - interval '24 hours')))
);