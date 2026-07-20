
-- 1. spartanops_checkins: restrict PII columns + drop broken update policy
DROP POLICY IF EXISTS "checkins public read" ON public.spartanops_checkins;
DROP POLICY IF EXISTS "public can read roster" ON public.spartanops_checkins;
DROP POLICY IF EXISTS "public can update own checkin" ON public.spartanops_checkins;

CREATE POLICY "checkins roster read" ON public.spartanops_checkins
  FOR SELECT TO anon, authenticated USING (true);

REVOKE SELECT ON public.spartanops_checkins FROM anon, authenticated;
GRANT SELECT (id, field_id, session_id, callsign, assigned_team, team_changed_flag, experience_level, created_at)
  ON public.spartanops_checkins TO anon, authenticated;
GRANT INSERT ON public.spartanops_checkins TO anon, authenticated;
GRANT ALL ON public.spartanops_checkins TO service_role;

-- 2. spartanops_captures: scope INSERT to a real participant on the correct team/field
DROP POLICY IF EXISTS "captures public insert" ON public.spartanops_captures;
CREATE POLICY "captures scoped insert" ON public.spartanops_captures
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.spartanops_checkins c
      WHERE c.field_id = spartanops_captures.field_id
        AND c.callsign = spartanops_captures.player_callsign
        AND c.assigned_team = spartanops_captures.team
    )
  );

-- 3. event_cancellations: no public SELECT; served via trusted server function
DROP POLICY IF EXISTS "cancellations public read" ON public.event_cancellations;
GRANT ALL ON public.event_cancellations TO service_role;

-- 4. event_registrations: explicit deny-select policy (defence in depth vs. future misconfig)
DROP POLICY IF EXISTS "event_registrations service only" ON public.event_registrations;
CREATE POLICY "event_registrations no client read" ON public.event_registrations
  FOR SELECT TO anon, authenticated USING (false);
GRANT ALL ON public.event_registrations TO service_role;

-- 5. registrations: explicit deny-select policy
DROP POLICY IF EXISTS "registrations service only" ON public.registrations;
CREATE POLICY "registrations no client read" ON public.registrations
  FOR SELECT TO anon, authenticated USING (false);
GRANT ALL ON public.registrations TO service_role;

-- 6. Views: switch to SECURITY INVOKER so RLS applies to the querying user
ALTER VIEW public.spartanops_lobbies_public SET (security_invoker = true);
ALTER VIEW public.event_registrations_public SET (security_invoker = true);
ALTER VIEW public.registrations_public SET (security_invoker = true);
-- The public "registrations_public" view exposes safe columns of confirmed
-- registrations; grant SELECT explicitly since the base table now denies it.
GRANT SELECT ON public.registrations_public TO anon, authenticated;
GRANT SELECT ON public.event_registrations_public TO anon, authenticated;
GRANT SELECT ON public.spartanops_lobbies_public TO anon, authenticated;

-- registrations_public / event_registrations_public read the base tables.
-- With security_invoker, the invoker needs SELECT on the base rows; grant
-- narrow column SELECT to make the public views work without exposing PII.
GRANT SELECT (id, event_id, callsign, gear_type, avatar, team_club, first_name, last_initial, experience_level, created_at, is_confirmed)
  ON public.registrations TO anon, authenticated;
GRANT SELECT (id, event_id, wants_food, public_callsign, loadout_role, avatar_id, created_at)
  ON public.event_registrations TO anon, authenticated;

-- 7. Revoke EXECUTE on SECURITY DEFINER functions that don't need to be public.
REVOKE EXECUTE ON FUNCTION public.verify_field_password(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.spartanops_acknowledge_team_change(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.spartanops_apply_capture(text, integer, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.spartanops_bootstrap_game_state() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
