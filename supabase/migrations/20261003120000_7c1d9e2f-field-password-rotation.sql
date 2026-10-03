ALTER TABLE public.spartanops_accounts
  ADD COLUMN IF NOT EXISTS field_password_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS field_password_changed_at timestamptz;

CREATE OR REPLACE FUNCTION public.spartanops_set_field_password(p_password text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_pw text := lower(btrim(coalesce(p_password, '')));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF length(v_pw) < 4 OR length(v_pw) > 64 THEN RAISE EXCEPTION 'password_length'; END IF;
  UPDATE public.spartanops_accounts
     SET field_password_hash = public.spartanops_hash_password(v_pw),
         field_password_version = field_password_version + 1,
         field_password_changed_at = now()
   WHERE id = auth.uid();
END; $$;
REVOKE EXECUTE ON FUNCTION public.spartanops_set_field_password(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spartanops_set_field_password(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.spartanops_verify_field_password(p_account_id uuid, p_password text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE v_hash text; v_pw text := lower(btrim(coalesce(p_password, '')));
BEGIN
  IF length(v_pw) = 0 OR length(v_pw) > 64 THEN RETURN false; END IF;
  SELECT field_password_hash INTO v_hash FROM public.spartanops_accounts WHERE id = p_account_id;
  IF v_hash IS NULL THEN RETURN false; END IF;
  RETURN v_hash = crypt(v_pw, v_hash);
END; $$;
REVOKE EXECUTE ON FUNCTION public.spartanops_verify_field_password(uuid, text) FROM PUBLIC, anon, authenticated;
