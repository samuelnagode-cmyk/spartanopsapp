DROP POLICY IF EXISTS "public can read game state" ON public.spartanops_game_state;
CREATE POLICY "game state scoped read" ON public.spartanops_game_state
FOR SELECT USING (status = ANY (ARRAY['lobby'::text,'pre_match'::text,'active'::text,'paused'::text]));