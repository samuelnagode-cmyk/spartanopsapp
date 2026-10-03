CREATE TABLE IF NOT EXISTS public.spartanops_field_attempts (
  id bigserial PRIMARY KEY,
  account_id uuid NOT NULL REFERENCES public.spartanops_accounts(id) ON DELETE CASCADE,
  ip_hash text NOT NULL,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS spartanops_field_attempts_lookup ON public.spartanops_field_attempts (account_id, ip_hash, at DESC);
ALTER TABLE public.spartanops_field_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spartanops_field_attempts FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.spartanops_field_attempts TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.spartanops_field_attempts_id_seq TO service_role;
