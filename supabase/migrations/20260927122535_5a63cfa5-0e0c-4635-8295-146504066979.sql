-- spartanops_accounts: marshal account profiles (id mirrors auth.users.id)

CREATE TABLE public.spartanops_accounts (
  id uuid NOT NULL,
  business_name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT spartanops_accounts_pkey PRIMARY KEY (id),
  CONSTRAINT spartanops_accounts_id_fkey FOREIGN KEY (id) REFERENCES auth.users (id) ON DELETE CASCADE
);

GRANT ALL ON public.spartanops_accounts TO anon;
GRANT ALL ON public.spartanops_accounts TO authenticated;
GRANT ALL ON public.spartanops_accounts TO service_role;

ALTER TABLE public.spartanops_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users can insert own account"
  ON public.spartanops_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "users can read own account"
  ON public.spartanops_accounts
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "users can update own account"
  ON public.spartanops_accounts
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);
