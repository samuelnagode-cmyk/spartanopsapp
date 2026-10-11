ALTER TABLE public.spartanops_events
  ADD COLUMN price_amount numeric(8,2) NULL CHECK (price_amount IS NULL OR (price_amount >= 0 AND price_amount <= 9999.99)),
  ADD COLUMN price_currency text NULL CHECK (price_currency IS NULL OR price_currency ~ '^[A-Z]{3}$'),
  ADD COLUMN price_note text NULL CHECK (price_note IS NULL OR char_length(price_note) <= 60),
  ADD COLUMN lat double precision NULL CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),
  ADD COLUMN lng double precision NULL CHECK (lng IS NULL OR lng BETWEEN -180 AND 180),
  ADD COLUMN location_visibility text NOT NULL DEFAULT 'public' CHECK (location_visibility IN ('public','going')),
  ADD CONSTRAINT events_price_pair CHECK ((price_amount IS NULL) = (price_currency IS NULL)),
  ADD CONSTRAINT events_latlng_pair CHECK ((lat IS NULL) = (lng IS NULL));

CREATE TABLE public.spartanops_field_profiles (
  account_id uuid PRIMARY KEY REFERENCES public.spartanops_accounts(id) ON DELETE CASCADE,
  lat double precision NULL CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),
  lng double precision NULL CHECK (lng IS NULL OR lng BETWEEN -180 AND 180),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT field_profile_latlng_pair CHECK ((lat IS NULL) = (lng IS NULL))
);
ALTER TABLE public.spartanops_field_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spartanops_field_profiles FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.spartanops_field_profiles TO service_role;