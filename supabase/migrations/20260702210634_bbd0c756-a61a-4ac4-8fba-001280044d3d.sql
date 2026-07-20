ALTER TABLE public.spartanops_checkins
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_initial TEXT;