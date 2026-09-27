ALTER TABLE public.spartanops_lobbies
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.spartanops_accounts(id);

CREATE POLICY "authenticated users can claim unowned lobbies"
  ON public.spartanops_lobbies
  FOR UPDATE
  TO authenticated
  USING (account_id IS NULL)
  WITH CHECK (account_id = auth.uid());

CREATE POLICY "authenticated users can read own lobbies"
  ON public.spartanops_lobbies
  FOR SELECT
  TO authenticated
  USING (account_id = auth.uid());

GRANT SELECT, UPDATE ON public.spartanops_lobbies TO authenticated;
