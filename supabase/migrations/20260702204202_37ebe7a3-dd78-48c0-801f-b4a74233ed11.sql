ALTER TABLE public.spartanops_game_state
  ADD COLUMN IF NOT EXISTS gamemode text NOT NULL DEFAULT 'domination',
  ADD COLUMN IF NOT EXISTS event_name text;