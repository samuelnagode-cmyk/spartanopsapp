-- Data-free "roster changed" broadcast so browsers no longer need direct access
-- to spartanops_checkins for live updates; then remove anon's grant.
CREATE OR REPLACE FUNCTION public.spartanops_broadcast_roster_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_field text := COALESCE(NEW.field_id, OLD.field_id);
BEGIN
  BEGIN
    PERFORM realtime.send(
      jsonb_build_object('field_id', v_field, 'op', TG_OP),
      'roster_changed',
      'checkins:' || v_field,
      false
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- never block a check-in write because a broadcast failed
  END;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.spartanops_broadcast_roster_change() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER trg_spartanops_checkins_broadcast
AFTER INSERT OR UPDATE OR DELETE ON public.spartanops_checkins
FOR EACH ROW EXECUTE FUNCTION public.spartanops_broadcast_roster_change();

REVOKE ALL ON public.spartanops_checkins FROM anon;
