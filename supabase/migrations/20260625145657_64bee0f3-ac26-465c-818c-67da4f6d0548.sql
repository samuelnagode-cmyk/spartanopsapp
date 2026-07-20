ALTER TABLE public.spartanops_match
  ADD COLUMN IF NOT EXISTS node_d text NOT NULL DEFAULT 'neutral',
  ADD COLUMN IF NOT EXISTS node_e text NOT NULL DEFAULT 'neutral';