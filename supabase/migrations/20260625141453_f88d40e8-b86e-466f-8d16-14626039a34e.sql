
ALTER TABLE public.spartanops_players
  ADD COLUMN IF NOT EXISTS club_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS avatar_id text NOT NULL DEFAULT '01';

ALTER TABLE public.spartanops_match
  ADD COLUMN IF NOT EXISTS node_a text NOT NULL DEFAULT 'neutral',
  ADD COLUMN IF NOT EXISTS node_b text NOT NULL DEFAULT 'neutral',
  ADD COLUMN IF NOT EXISTS node_c text NOT NULL DEFAULT 'neutral',
  ADD COLUMN IF NOT EXISTS victory_condition text NOT NULL DEFAULT 'points';

-- Allow public faction swap (admin-only in UI but no auth gate)
DO $$ BEGIN
  CREATE POLICY "Public update players" ON public.spartanops_players
    FOR UPDATE USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
