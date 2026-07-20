
-- 1) Archived missions: remove public read access; server-only via service_role.
DROP POLICY IF EXISTS "Archived missions are publicly readable" ON public.spartanops_archived_missions;
REVOKE SELECT ON public.spartanops_archived_missions FROM anon, authenticated;

-- 2) Captures: hide raw GPS/distance columns from public roles.
REVOKE SELECT (latitude, longitude, distance_m) ON public.spartanops_captures FROM anon, authenticated;

-- Marshal-only accessor for suspicious captures (includes coords + distance).
CREATE OR REPLACE FUNCTION public.spartanops_get_suspicious_captures(
  p_field_id text,
  p_marshal_password text
)
RETURNS TABLE (
  id uuid,
  point_number integer,
  team text,
  player_callsign text,
  latitude double precision,
  longitude double precision,
  distance_m double precision,
  captured_at timestamptz,
  spartacus_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_ok boolean := false;
  v_hash text;
  v_uuid uuid;
BEGIN
  IF p_field_id IS NULL OR length(p_field_id) = 0 THEN RETURN; END IF;
  IF p_marshal_password IS NULL OR length(p_marshal_password) NOT BETWEEN 3 AND 200 THEN RETURN; END IF;

  BEGIN
    v_uuid := p_field_id::uuid;
    SELECT marshal_password_hash INTO v_hash
      FROM public.spartanops_lobbies
     WHERE id = v_uuid;
    IF v_hash IS NOT NULL AND v_hash = crypt(p_marshal_password, v_hash) THEN
      v_ok := true;
    END IF;
  EXCEPTION WHEN invalid_text_representation THEN
    v_ok := false;
  END;

  IF NOT v_ok THEN RETURN; END IF;

  RETURN QUERY
    SELECT c.id, c.point_number, c.team, c.player_callsign,
           c.latitude, c.longitude, c.distance_m,
           c.captured_at, c.spartacus_status
      FROM public.spartanops_captures c
     WHERE c.field_id = p_field_id
       AND c.suspicious = true
       AND c.spartacus_status = 'pending'
     ORDER BY c.captured_at DESC
     LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION public.spartanops_get_suspicious_captures(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spartanops_get_suspicious_captures(text, text) TO anon, authenticated, service_role;
