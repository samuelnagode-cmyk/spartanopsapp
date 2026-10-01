CREATE OR REPLACE FUNCTION public.spartanops_broadcast_active_mission_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.active_lobby_id IS DISTINCT FROM OLD.active_lobby_id THEN
    BEGIN
      PERFORM realtime.send(
        jsonb_build_object('active_lobby_id', NEW.active_lobby_id),
        'active_mission_changed',
        'field:' || NEW.id::text,
        false
      );
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.spartanops_broadcast_active_mission_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_spartanops_broadcast_active_mission_change ON public.spartanops_accounts;
CREATE TRIGGER trg_spartanops_broadcast_active_mission_change
  AFTER UPDATE ON public.spartanops_accounts
  FOR EACH ROW EXECUTE FUNCTION public.spartanops_broadcast_active_mission_change();
