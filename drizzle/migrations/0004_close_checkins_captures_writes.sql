-- Browsers never write to these two tables. Every write goes through a server function (service role).
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('spartanops_checkins', 'spartanops_captures')
      AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', p.policyname, p.tablename);
  END LOOP;
END $$;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.spartanops_checkins FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.spartanops_captures FROM PUBLIC, anon, authenticated;