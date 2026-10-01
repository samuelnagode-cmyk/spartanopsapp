-- Platform showcase flag: the one account whose missions appear on public pages.
ALTER TABLE public.spartanops_accounts
  ADD COLUMN IF NOT EXISTS is_platform_showcase boolean NOT NULL DEFAULT false;

UPDATE public.spartanops_accounts SET is_platform_showcase = true WHERE business_name = 'ZELENI RAJ';

-- Owner on archived missions, so /archive can be scoped per account.
ALTER TABLE public.spartanops_archived_missions
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.spartanops_accounts(id);

-- Backfill from live lobbies where possible.
UPDATE public.spartanops_archived_missions a
   SET account_id = l.account_id
  FROM public.spartanops_lobbies l
 WHERE l.id = a.lobby_id AND a.account_id IS NULL;

-- Pre-account archives (lobbies already deleted) go to the showcase account.
UPDATE public.spartanops_archived_missions
   SET account_id = (SELECT id FROM public.spartanops_accounts WHERE is_platform_showcase LIMIT 1)
 WHERE account_id IS NULL;

-- Future archives: copy the owner from the lobby being archived.
CREATE OR REPLACE FUNCTION public.spartanops_archive_fill_account()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.account_id IS NULL THEN
    SELECT account_id INTO NEW.account_id FROM public.spartanops_lobbies WHERE id = NEW.lobby_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.spartanops_archive_fill_account() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_spartanops_archive_fill_account ON public.spartanops_archived_missions;
CREATE TRIGGER trg_spartanops_archive_fill_account
  BEFORE INSERT ON public.spartanops_archived_missions
  FOR EACH ROW EXECUTE FUNCTION public.spartanops_archive_fill_account();
