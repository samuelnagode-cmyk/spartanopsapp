
-- =========================================================================
-- 1. Create private secrets table for session_id + PII
-- =========================================================================
CREATE TABLE IF NOT EXISTS public.spartanops_checkin_secrets (
  checkin_id uuid PRIMARY KEY REFERENCES public.spartanops_checkins(id) ON DELETE CASCADE,
  session_id text NOT NULL UNIQUE,
  first_name text,
  last_initial text,
  club text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.spartanops_checkin_secrets TO service_role;
ALTER TABLE public.spartanops_checkin_secrets ENABLE ROW LEVEL SECURITY;
-- No policies for anon/authenticated -> table is invisible to public clients.
CREATE POLICY "service role only" ON public.spartanops_checkin_secrets
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Backfill from existing checkins (only if the source columns still exist).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='spartanops_checkins' AND column_name='session_id'
  ) THEN
    INSERT INTO public.spartanops_checkin_secrets (checkin_id, session_id, first_name, last_initial, club, created_at)
    SELECT id, session_id, first_name, last_initial, club, COALESCE(created_at, now())
      FROM public.spartanops_checkins
    ON CONFLICT (checkin_id) DO NOTHING;
  END IF;
END $$;

-- =========================================================================
-- 2. Update SECURITY DEFINER RPCs to look up session_id via secrets join
-- =========================================================================
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
  SELECT c.* INTO v_checkin
    FROM public.spartanops_checkins c
    JOIN public.spartanops_checkin_secrets s ON s.checkin_id = c.id
   WHERE s.session_id = p_session_id AND c.field_id = p_field_id;
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

CREATE OR REPLACE FUNCTION public.spartanops_acknowledge_team_change(p_field_id text, p_session_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.spartanops_checkins c
     SET team_changed_flag = false
    FROM public.spartanops_checkin_secrets s
   WHERE s.checkin_id = c.id
     AND s.session_id = p_session_id
     AND c.field_id  = p_field_id;
END;
$function$;

-- =========================================================================
-- 3. Drop sensitive columns from the public roster table
-- =========================================================================
ALTER TABLE public.spartanops_checkins DROP COLUMN IF EXISTS session_id;
ALTER TABLE public.spartanops_checkins DROP COLUMN IF EXISTS first_name;
ALTER TABLE public.spartanops_checkins DROP COLUMN IF EXISTS last_initial;
ALTER TABLE public.spartanops_checkins DROP COLUMN IF EXISTS club;

-- Now the entire row is safe to expose; re-grant simple column SELECT.
GRANT SELECT ON public.spartanops_checkins TO anon, authenticated;

-- =========================================================================
-- 4. Lock down spartanops_qr_anchors: server-role reads only
-- =========================================================================
REVOKE SELECT ON public.spartanops_qr_anchors FROM anon, authenticated;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
     WHERE schemaname='public' AND tablename='spartanops_qr_anchors'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.spartanops_qr_anchors', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "service role only" ON public.spartanops_qr_anchors
  FOR ALL TO service_role USING (true) WITH CHECK (true);
