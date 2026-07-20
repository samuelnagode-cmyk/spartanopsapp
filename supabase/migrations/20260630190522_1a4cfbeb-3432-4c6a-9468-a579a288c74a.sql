ALTER TABLE public.spartanops_game_state
  DROP CONSTRAINT IF EXISTS spartanops_game_state_status_check;

ALTER TABLE public.spartanops_game_state
  ADD CONSTRAINT spartanops_game_state_status_check
  CHECK (status IN ('closed', 'lobby', 'active', 'paused', 'ended'));

UPDATE public.spartanops_game_state
   SET updated_at = now()
 WHERE status IN ('closed', 'lobby', 'active', 'paused', 'ended');