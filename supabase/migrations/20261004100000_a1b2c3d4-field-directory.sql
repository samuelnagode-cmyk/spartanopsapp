ALTER TABLE public.spartanops_accounts
  ADD COLUMN IF NOT EXISTS listed_publicly boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS listing_blocked boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.spartanops_fold(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT translate(lower(coalesce(p, '')), 'čćšžđáàäâéèêëíìîïóòöôúùüûñç', 'ccszdaaaaeeeeiiiioooouuuunc')
$$;

ALTER TABLE public.spartanops_accounts
  ADD COLUMN IF NOT EXISTS name_fold text GENERATED ALWAYS AS (public.spartanops_fold(business_name)) STORED;

GRANT UPDATE (listed_publicly) ON public.spartanops_accounts TO authenticated;
