CREATE TABLE public.spartanops_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.spartanops_accounts(id) ON DELETE CASCADE,
  series_id uuid NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
  title_fold text GENERATED ALWAYS AS (public.spartanops_fold(title)) STORED,
  kind text NOT NULL CHECK (kind IN ('skirmish','scenario','milsim','night','tournament','training','other')),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NULL,
  tz text NOT NULL DEFAULT 'Europe/Ljubljana',
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 4000),
  rules_text text NULL CHECK (rules_text IS NULL OR char_length(rules_text) <= 1500),
  location_text text NULL CHECK (location_text IS NULL OR char_length(location_text) <= 160),
  maps_url text NULL CHECK (maps_url IS NULL OR char_length(maps_url) <= 300),
  price_text text NULL CHECK (price_text IS NULL OR char_length(price_text) <= 80),
  capacity integer NULL CHECK (capacity IS NULL OR capacity BETWEEN 2 AND 500),
  min_age integer NULL CHECK (min_age IS NULL OR min_age BETWEEN 10 AND 21),
  signup_url text NULL CHECK (signup_url IS NULL OR char_length(signup_url) <= 300),
  contact_text text NULL CHECK (contact_text IS NULL OR char_length(contact_text) <= 120),
  visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','link')),
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('published','cancelled','hidden')),
  cancel_reason text NULL CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 140),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT events_end_after_start CHECK (ends_at IS NULL OR ends_at > starts_at)
);
CREATE INDEX spartanops_events_starts_idx ON public.spartanops_events (starts_at) WHERE status <> 'hidden';
CREATE INDEX spartanops_events_account_idx ON public.spartanops_events (account_id, starts_at);
CREATE INDEX spartanops_events_series_idx ON public.spartanops_events (series_id) WHERE series_id IS NOT NULL;
ALTER TABLE public.spartanops_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spartanops_events FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.spartanops_events TO service_role;