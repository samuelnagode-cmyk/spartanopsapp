
-- Password helpers using pgcrypto (bcrypt). Server-role only.

CREATE OR REPLACE FUNCTION public.spartanops_hash_password(p_password text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF p_password IS NULL OR length(p_password) < 3 OR length(p_password) > 200 THEN
    RAISE EXCEPTION 'invalid_password_length';
  END IF;
  RETURN crypt(p_password, gen_salt('bf'));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.spartanops_hash_password(text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.spartanops_verify_lobby_password(
  p_lobby_id uuid,
  p_password text,
  p_kind text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash text;
BEGIN
  IF p_password IS NULL OR length(p_password) > 200 THEN RETURN false; END IF;
  IF p_kind = 'player' THEN
    SELECT password_hash INTO v_hash FROM public.spartanops_lobbies WHERE id = p_lobby_id;
  ELSIF p_kind = 'marshal' THEN
    SELECT marshal_password_hash INTO v_hash FROM public.spartanops_lobbies WHERE id = p_lobby_id;
  ELSE
    RETURN false;
  END IF;
  IF v_hash IS NULL THEN RETURN false; END IF;
  RETURN v_hash = crypt(p_password, v_hash);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.spartanops_verify_lobby_password(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- Wipe every check-in / capture belonging to a given lobby id.
CREATE OR REPLACE FUNCTION public.spartanops_delete_lobby_players(p_lobby_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.spartanops_captures WHERE field_id = p_lobby_id;
  DELETE FROM public.spartanops_checkins WHERE field_id = p_lobby_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.spartanops_delete_lobby_players(text) FROM PUBLIC, anon, authenticated;

-- Fully delete a lobby (decommission): removes lobby row + game state + checkins + captures.
CREATE OR REPLACE FUNCTION public.spartanops_delete_lobby(p_lobby_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_text_id text := p_lobby_id::text;
BEGIN
  DELETE FROM public.spartanops_captures    WHERE field_id = v_text_id;
  DELETE FROM public.spartanops_checkins    WHERE field_id = v_text_id;
  DELETE FROM public.spartanops_game_state  WHERE field_id = v_text_id;
  DELETE FROM public.spartanops_lobbies     WHERE id       = p_lobby_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.spartanops_delete_lobby(uuid) FROM PUBLIC, anon, authenticated;
