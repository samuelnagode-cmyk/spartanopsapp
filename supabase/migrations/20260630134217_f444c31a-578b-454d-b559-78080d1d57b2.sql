
-- 1) Field secrets table with bcrypt-hashed admin passwords (server-only)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.spartanops_field_secrets (
  field_id text PRIMARY KEY,
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.spartanops_field_secrets TO service_role;
-- No anon/authenticated grants: server-side only.
ALTER TABLE public.spartanops_field_secrets ENABLE ROW LEVEL SECURITY;
-- No policies → locked to service_role/admin only.

INSERT INTO public.spartanops_field_secrets (field_id, password_hash) VALUES
  ('prijave',     crypt('spartanjenajaci123', gen_salt('bf'))),
  ('zeleni-raj',  crypt('spartanjenajaci123', gen_salt('bf'))),
  ('field-1',     crypt('PROMO251', gen_salt('bf'))),
  ('field-2',     crypt('PROMO555', gen_salt('bf'))),
  ('field-3',     crypt('661', gen_salt('bf')))
ON CONFLICT (field_id) DO UPDATE
  SET password_hash = EXCLUDED.password_hash, updated_at = now();

-- 2) Strip personal-name columns from realtime/publicly-readable game tables.
--    UI will use callsign as the only public identity from now on.
ALTER TABLE public.spartanops_checkins  DROP COLUMN IF EXISTS name;
ALTER TABLE public.spartanops_captures  DROP COLUMN IF EXISTS player_name;

-- Make callsign the required public identity. Backfill any nulls first.
UPDATE public.spartanops_checkins
   SET callsign = COALESCE(NULLIF(callsign, ''), 'AGENT-' || substr(id::text, 1, 6))
 WHERE callsign IS NULL OR callsign = '';
ALTER TABLE public.spartanops_checkins ALTER COLUMN callsign SET NOT NULL;

-- 3) Rewrite the capture function so it no longer references the dropped player_name column.
CREATE OR REPLACE FUNCTION public.spartanops_apply_capture(p_field_id text, p_point integer, p_session_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_checkin public.spartanops_checkins%ROWTYPE;
  v_state public.spartanops_game_state%ROWTYPE;
  v_prev_holder text; v_scores jsonb; v_holders jsonb;
  v_new_score int; v_target int; v_new_status text; v_winner text;
BEGIN
  IF p_point NOT BETWEEN 1 AND 5 THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_point'); END IF;
  SELECT * INTO v_checkin FROM public.spartanops_checkins WHERE session_id = p_session_id AND field_id = p_field_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'not_checked_in'); END IF;
  IF v_checkin.assigned_team = 'none' THEN RETURN jsonb_build_object('ok', false, 'error', 'no_team'); END IF;
  SELECT * INTO v_state FROM public.spartanops_game_state WHERE field_id = p_field_id;
  IF v_state.status <> 'active' THEN RETURN jsonb_build_object('ok', false, 'error', 'match_not_active'); END IF;
  v_prev_holder := v_state.node_holders->>(p_point::text);
  IF v_prev_holder = v_checkin.assigned_team THEN RETURN jsonb_build_object('ok', true, 'already_held', true); END IF;
  v_holders := jsonb_set(v_state.node_holders, ARRAY[p_point::text], to_jsonb(v_checkin.assigned_team));
  v_new_score := COALESCE((v_state.team_scores->>v_checkin.assigned_team)::int, 0) + 1;
  v_scores  := jsonb_set(v_state.team_scores,  ARRAY[v_checkin.assigned_team], to_jsonb(v_new_score));
  v_target := COALESCE(v_state.point_target, 50);
  v_new_status := v_state.status; v_winner := v_state.winner_team;
  IF v_new_score >= v_target THEN v_new_status := 'ended'; v_winner := v_checkin.assigned_team; END IF;
  UPDATE public.spartanops_game_state
     SET node_holders = v_holders, team_scores = v_scores,
         status = v_new_status, winner_team = v_winner, updated_at = now()
   WHERE field_id = p_field_id;
  INSERT INTO public.spartanops_captures (field_id, point_number, team, player_checkin_id, player_callsign)
  VALUES (p_field_id, p_point, v_checkin.assigned_team, v_checkin.id, v_checkin.callsign);
  RETURN jsonb_build_object('ok', true, 'team', v_checkin.assigned_team, 'ended', v_new_status = 'ended');
END;
$function$;

-- 4) Lock SECURITY DEFINER functions to service_role only (called from server functions).
REVOKE EXECUTE ON FUNCTION public.spartanops_apply_capture(text, integer, text)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.spartanops_apply_capture(text, integer, text)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.spartanops_acknowledge_team_change(text, text)
  FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.spartanops_acknowledge_team_change(text, text)
  TO service_role;

-- 5) Recreate registrations_public as a SECURITY INVOKER view that exposes ONLY non-PII columns.
DROP VIEW IF EXISTS public.registrations_public;
CREATE VIEW public.registrations_public
  WITH (security_invoker = true) AS
SELECT id, event_id, callsign, gear_type, avatar, team_club, created_at
FROM public.registrations
WHERE is_confirmed = true;
GRANT SELECT ON public.registrations_public TO anon, authenticated;

-- 6) Storage policies for the private spartanops-maps bucket.
DROP POLICY IF EXISTS "spartanops-maps service_role all" ON storage.objects;
CREATE POLICY "spartanops-maps service_role all"
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'spartanops-maps')
  WITH CHECK (bucket_id = 'spartanops-maps');
-- No anon/authenticated policies → only the service-role server function can read or write.
-- Players see maps via signed URLs (which bypass RLS via the signing token).
