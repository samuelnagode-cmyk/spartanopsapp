DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.spartanops_lobbies WHERE account_id IS NULL) THEN
    ALTER TABLE public.spartanops_lobbies ALTER COLUMN account_id SET NOT NULL;
  END IF;
END $$;

DROP POLICY IF EXISTS "authenticated users can claim unowned lobbies" ON public.spartanops_lobbies;
DROP POLICY IF EXISTS "authenticated users can see unowned lobbies to claim them" ON public.spartanops_lobbies;
REVOKE UPDATE ON public.spartanops_lobbies FROM authenticated;
