ALTER TABLE public.spartanops_players
  ADD COLUMN avatar_icon text NULL CHECK (avatar_icon IS NULL OR avatar_icon ~ '^[a-z0-9_]{2,24}$'),
  ADD COLUMN avatar_color text NULL CHECK (avatar_color IS NULL OR avatar_color ~ '^[a-z0-9_]{2,24}$');