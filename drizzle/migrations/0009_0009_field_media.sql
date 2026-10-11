ALTER TABLE public.spartanops_field_profiles
  ADD COLUMN logo_path text NULL CHECK (logo_path IS NULL OR char_length(logo_path) <= 200),
  ADD COLUMN map_path text NULL CHECK (map_path IS NULL OR char_length(map_path) <= 200),
  ADD COLUMN media_updated_at timestamptz NULL;
ALTER TABLE public.spartanops_events
  ADD COLUMN show_field_map boolean NOT NULL DEFAULT true;