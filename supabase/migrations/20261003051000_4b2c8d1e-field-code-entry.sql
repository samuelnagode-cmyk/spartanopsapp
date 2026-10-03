-- Field code (server-controlled) + account guard + column grants + active-mission FK ON DELETE SET NULL
ALTER TABLE public.spartanops_accounts ADD COLUMN IF NOT EXISTS field_code text;
CREATE UNIQUE INDEX IF NOT EXISTS spartanops_accounts_field_code_key ON public.spartanops_accounts (field_code);

CREATE OR REPLACE FUNCTION public.spartanops_generate_field_code() RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..6 LOOP
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.spartanops_accounts WHERE field_code = candidate);
  END LOOP;
  RETURN candidate;
END; $$;
REVOKE ALL ON FUNCTION public.spartanops_generate_field_code() FROM PUBLIC, anon, authenticated;

UPDATE public.spartanops_accounts SET field_code = public.spartanops_generate_field_code() WHERE field_code IS NULL;

CREATE OR REPLACE FUNCTION public.spartanops_accounts_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.field_code := public.spartanops_generate_field_code();
  ELSE
    IF OLD.field_code IS NOT NULL THEN NEW.field_code := OLD.field_code; END IF;
    IF NEW.active_lobby_id IS NOT NULL AND NEW.active_lobby_id IS DISTINCT FROM OLD.active_lobby_id THEN
      IF NOT EXISTS (SELECT 1 FROM public.spartanops_lobbies WHERE id = NEW.active_lobby_id AND account_id = NEW.id) THEN
        RAISE EXCEPTION 'active mission must belong to this account';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.spartanops_accounts_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_spartanops_accounts_guard ON public.spartanops_accounts;
CREATE TRIGGER trg_spartanops_accounts_guard
  BEFORE INSERT OR UPDATE ON public.spartanops_accounts
  FOR EACH ROW EXECUTE FUNCTION public.spartanops_accounts_guard();

REVOKE INSERT, UPDATE ON public.spartanops_accounts FROM authenticated;
GRANT INSERT (id, business_name) ON public.spartanops_accounts TO authenticated;
GRANT UPDATE (business_name, active_lobby_id) ON public.spartanops_accounts TO authenticated;

ALTER TABLE public.spartanops_accounts DROP CONSTRAINT IF EXISTS spartanops_accounts_active_lobby_id_fkey;
ALTER TABLE public.spartanops_accounts ADD CONSTRAINT spartanops_accounts_active_lobby_id_fkey
  FOREIGN KEY (active_lobby_id) REFERENCES public.spartanops_lobbies(id) ON DELETE SET NULL;
