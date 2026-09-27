-- Temporary: lets any signed-in account see unowned lobbies so the claim
-- (UPDATE ... RETURNING) can match them. Revisit once >1 real account exists.
CREATE POLICY "authenticated users can see unowned lobbies to claim them"
  ON public.spartanops_lobbies
  FOR SELECT
  TO authenticated
  USING (account_id IS NULL);
