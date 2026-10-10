CREATE TABLE public.spartanops_players (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text NOT NULL CHECK (char_length(nickname) BETWEEN 2 AND 24),
  first_name text NOT NULL CHECK (char_length(first_name) BETWEEN 1 AND 40),
  last_name text NULL CHECK (last_name IS NULL OR char_length(last_name) BETWEEN 1 AND 40),
  show_full_last_name boolean NOT NULL DEFAULT false,
  age_group text NOT NULL CHECK (age_group IN ('16_17','18_plus')),
  phone text NULL CHECK (phone IS NULL OR phone ~ '^\+[1-9][0-9]{7,14}$'),
  club text NULL CHECK (club IS NULL OR char_length(club) <= 60),
  experience_level text NOT NULL DEFAULT 'dobro' CHECK (experience_level IN ('slabo','dobro','zelo_dobro')),
  operator_type text NULL CHECK (operator_type IS NULL OR operator_type IN ('AEG','SNIPER','DMR','PUMP')),
  primary_weapon text NULL CHECK (primary_weapon IS NULL OR char_length(primary_weapon) <= 60),
  secondary_weapon text NULL CHECK (secondary_weapon IS NULL OR char_length(secondary_weapon) <= 60),
  sidearm text NULL CHECK (sidearm IS NULL OR char_length(sidearm) <= 60),
  gear_notes text NULL CHECK (gear_notes IS NULL OR char_length(gear_notes) <= 140),
  privacy_version text NOT NULL,
  privacy_accepted_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT players_minor_limits CHECK (
    age_group = '18_plus' OR (last_name IS NULL AND phone IS NULL AND show_full_last_name = false)
  )
);
ALTER TABLE public.spartanops_players ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spartanops_players FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.spartanops_players TO service_role;