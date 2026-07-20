-- 1. Restrict column-level SELECT on spartanops_captures: hide GPS/telemetry from anon/authenticated
REVOKE SELECT (latitude, longitude, distance_m, suspicious, spartacus_status)
  ON public.spartanops_captures FROM anon, authenticated;

-- 2. Restrict column-level SELECT on spartanops_checkins: hide private warning + internal flag
REVOKE SELECT (warning_message, team_changed_flag)
  ON public.spartanops_checkins FROM anon, authenticated;

-- 3. Lock down SECURITY DEFINER function EXECUTE from anon/authenticated.
--    All these are only invoked via server-side supabaseAdmin (service_role bypasses
--    grants) except spartanops_get_suspicious_captures, which stays callable and
--    enforces marshal-password authorization inside the function body.
REVOKE EXECUTE ON FUNCTION public.spartanops_acknowledge_team_change(text, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.spartanops_hash_password(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.verify_field_password(text, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.spartanops_bootstrap_game_state() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.spartanops_apply_capture(text, integer, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.spartanops_verify_lobby_password(uuid, text, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.spartanops_reset_match_runtime(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.spartanops_delete_lobby_players(text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.spartanops_delete_lobby(uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.spartanops_get_field_map(text, text, text) FROM anon, authenticated, public;
