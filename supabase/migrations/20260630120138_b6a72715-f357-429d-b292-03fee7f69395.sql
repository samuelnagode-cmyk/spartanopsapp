ALTER TABLE public.spartanops_game_state
  ADD COLUMN IF NOT EXISTS node_positions jsonb NOT NULL DEFAULT '{"1":null,"2":null,"3":null,"4":null,"5":null}'::jsonb;

-- ensure match_started_at can hold a future timestamp (already timestamptz)
-- no schema change needed for countdown sync; we reuse match_started_at = future moment