-- Realtime publication requires replica identity for UPDATEs
ALTER TABLE public.spartanops_game_state REPLICA IDENTITY FULL;
ALTER TABLE public.spartanops_checkins REPLICA IDENTITY FULL;
ALTER TABLE public.spartanops_captures REPLICA IDENTITY FULL;

-- 1) game_state: rebuild with field_id as primary key, seed 4 fields
ALTER TABLE public.spartanops_game_state DROP CONSTRAINT IF EXISTS spartanops_game_state_pkey;
ALTER TABLE public.spartanops_game_state ADD COLUMN IF NOT EXISTS field_id text;
UPDATE public.spartanops_game_state SET field_id = 'zeleni-raj' WHERE field_id IS NULL;
ALTER TABLE public.spartanops_game_state ALTER COLUMN field_id SET NOT NULL;
ALTER TABLE public.spartanops_game_state ADD PRIMARY KEY (field_id);
ALTER TABLE public.spartanops_game_state ADD COLUMN IF NOT EXISTS field_label text;

INSERT INTO public.spartanops_game_state (field_id, field_label, status, team_selection_open, team_scores, node_holders)
VALUES
  ('zeleni-raj', 'SpartanOps Zeleni Raj', 'closed', false, '{"modra":0,"rdeca":0,"rumena":0}'::jsonb, '{"1":null,"2":null,"3":null,"4":null,"5":null}'::jsonb),
  ('field-1',    'SpartanOps 1',           'closed', false, '{"modra":0,"rdeca":0,"rumena":0}'::jsonb, '{"1":null,"2":null,"3":null,"4":null,"5":null}'::jsonb),
  ('field-2',    'SpartanOps 2',           'closed', false, '{"modra":0,"rdeca":0,"rumena":0}'::jsonb, '{"1":null,"2":null,"3":null,"4":null,"5":null}'::jsonb),
  ('field-3',    'SpartanOps 3',           'closed', false, '{"modra":0,"rdeca":0,"rumena":0}'::jsonb, '{"1":null,"2":null,"3":null,"4":null,"5":null}'::jsonb)
ON CONFLICT (field_id) DO NOTHING;

UPDATE public.spartanops_game_state SET field_label = 'SpartanOps Zeleni Raj' WHERE field_id = 'zeleni-raj' AND field_label IS NULL;
UPDATE public.spartanops_game_state SET field_label = 'SpartanOps 1' WHERE field_id = 'field-1' AND field_label IS NULL;
UPDATE public.spartanops_game_state SET field_label = 'SpartanOps 2' WHERE field_id = 'field-2' AND field_label IS NULL;
UPDATE public.spartanops_game_state SET field_label = 'SpartanOps 3' WHERE field_id = 'field-3' AND field_label IS NULL;

DELETE FROM public.spartanops_game_state WHERE field_id = 'current';

-- 2) checkins / captures: add field_id
ALTER TABLE public.spartanops_checkins ADD COLUMN IF NOT EXISTS field_id text NOT NULL DEFAULT 'zeleni-raj';
CREATE INDEX IF NOT EXISTS spartanops_checkins_field_idx ON public.spartanops_checkins(field_id);

ALTER TABLE public.spartanops_captures ADD COLUMN IF NOT EXISTS field_id text NOT NULL DEFAULT 'zeleni-raj';
CREATE INDEX IF NOT EXISTS spartanops_captures_field_idx ON public.spartanops_captures(field_id);

-- 3) Rebuild RPCs to be field-scoped
DROP FUNCTION IF EXISTS public.spartanops_apply_capture(integer, text);
CREATE OR REPLACE FUNCTION public.spartanops_apply_capture(p_field_id text, p_point integer, p_session_id text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_checkin public.spartanops_checkins%ROWTYPE;
  v_state public.spartanops_game_state%ROWTYPE;
  v_prev_holder text; v_scores jsonb; v_holders jsonb;
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
  v_scores := jsonb_set(v_state.team_scores, ARRAY[v_checkin.assigned_team],
    to_jsonb(COALESCE((v_state.team_scores->>v_checkin.assigned_team)::int, 0) + 1));
  UPDATE public.spartanops_game_state SET node_holders = v_holders, team_scores = v_scores, updated_at = now() WHERE field_id = p_field_id;
  INSERT INTO public.spartanops_captures (field_id, point_number, team, player_checkin_id, player_name, player_callsign)
  VALUES (p_field_id, p_point, v_checkin.assigned_team, v_checkin.id, v_checkin.name, v_checkin.callsign);
  RETURN jsonb_build_object('ok', true, 'team', v_checkin.assigned_team);
END;
$function$;

DROP FUNCTION IF EXISTS public.spartanops_acknowledge_team_change(text);
CREATE OR REPLACE FUNCTION public.spartanops_acknowledge_team_change(p_field_id text, p_session_id text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.spartanops_checkins SET team_changed_flag = false
   WHERE session_id = p_session_id AND field_id = p_field_id;
END;
$function$;
