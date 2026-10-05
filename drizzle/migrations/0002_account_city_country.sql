ALTER TABLE public.spartanops_accounts
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city_fold text GENERATED ALWAYS AS (public.spartanops_fold(city)) STORED;

ALTER TABLE public.spartanops_accounts
  ADD CONSTRAINT spartanops_accounts_country_format CHECK (country IS NULL OR country ~ '^[A-Z]{2}$'),
  ADD CONSTRAINT spartanops_accounts_city_length CHECK (city IS NULL OR length(city) BETWEEN 1 AND 80);

GRANT UPDATE (city, country) ON public.spartanops_accounts TO authenticated;