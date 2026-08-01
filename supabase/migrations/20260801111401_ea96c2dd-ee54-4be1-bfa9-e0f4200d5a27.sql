CREATE INDEX IF NOT EXISTS spartanops_captures_player_checkin_idx
  ON public.spartanops_captures (player_checkin_id);

CREATE INDEX IF NOT EXISTS spartanops_qr_anchors_field_idx
  ON public.spartanops_qr_anchors (field_id);

ALTER FUNCTION public.spartanops_delete_lobby(uuid) SET statement_timeout = '90s';
ALTER FUNCTION public.spartanops_delete_lobby_players(text) SET statement_timeout = '60s';
ALTER FUNCTION public.spartanops_reset_match_runtime(text) SET statement_timeout = '60s';