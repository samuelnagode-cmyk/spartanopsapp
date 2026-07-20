
-- marketing_subscribers: restrict to service_role only
DROP POLICY IF EXISTS "Service role manages subscribers" ON public.marketing_subscribers;
CREATE POLICY "Service role manages subscribers"
  ON public.marketing_subscribers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- event_registrations: replace WITH CHECK (true) with a content check
DROP POLICY IF EXISTS "Public can register" ON public.event_registrations;
CREATE POLICY "Public can register event"
  ON public.event_registrations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    event_id IS NOT NULL
    AND char_length(coalesce(email_or_phone, '')) BETWEEN 3 AND 160
    AND char_length(coalesce(full_name, '')) BETWEEN 1 AND 120
  );

-- registrations: same treatment
DROP POLICY IF EXISTS "Public can register" ON public.registrations;
CREATE POLICY "Public can register booking"
  ON public.registrations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    char_length(coalesce(event_title, '')) BETWEEN 1 AND 200
    AND char_length(coalesce(meal, '')) BETWEEN 1 AND 40
    AND char_length(coalesce(gear_type, '')) BETWEEN 1 AND 40
    AND char_length(coalesce(avatar, '')) BETWEEN 1 AND 40
  );

-- event_cancellations: explicit deny for direct client access
DROP POLICY IF EXISTS "deny all direct client access" ON public.event_cancellations;
CREATE POLICY "deny all direct client access"
  ON public.event_cancellations
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- spartanops_captures: explicit immutability to public clients
DROP POLICY IF EXISTS "captures immutable no update" ON public.spartanops_captures;
CREATE POLICY "captures immutable no update"
  ON public.spartanops_captures
  FOR UPDATE
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "captures immutable no delete" ON public.spartanops_captures;
CREATE POLICY "captures immutable no delete"
  ON public.spartanops_captures
  FOR DELETE
  TO anon, authenticated
  USING (false);

-- spartanops_field_secrets: explicit deny for direct client access
DROP POLICY IF EXISTS "deny all direct client access" ON public.spartanops_field_secrets;
CREATE POLICY "deny all direct client access"
  ON public.spartanops_field_secrets
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- Hide session_id from the public roster read (column-level revoke)
REVOKE SELECT (session_id) ON public.spartanops_checkins FROM anon;
REVOKE SELECT (session_id) ON public.spartanops_checkins FROM authenticated;

-- Consolidate duplicate SELECT policies on spartanops_game_state
DROP POLICY IF EXISTS "game_state public read" ON public.spartanops_game_state;
