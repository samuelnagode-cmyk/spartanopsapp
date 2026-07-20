
CREATE OR REPLACE FUNCTION public.verify_field_password(p_field_id text, p_password text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_hash text;
BEGIN
  IF p_password IS NULL OR length(p_password) > 200 THEN RETURN false; END IF;
  SELECT password_hash INTO v_hash FROM public.spartanops_field_secrets WHERE field_id = p_field_id;
  IF v_hash IS NULL THEN RETURN false; END IF;
  RETURN v_hash = crypt(p_password, v_hash);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.verify_field_password(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.verify_field_password(text, text)
  TO service_role;
