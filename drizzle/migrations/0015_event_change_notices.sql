ALTER TABLE public.spartanops_event_rsvps ADD COLUMN IF NOT EXISTS notify_changes boolean NOT NULL DEFAULT true;

CREATE TABLE public.spartanops_event_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.spartanops_events(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('cancelled','moved')),
  recipients integer NOT NULL,
  sent integer NOT NULL,
  failed integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX spartanops_event_notices_event_idx ON public.spartanops_event_notices (event_id, created_at DESC);
REVOKE ALL ON public.spartanops_event_notices FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.spartanops_event_notices TO service_role;
ALTER TABLE public.spartanops_event_notices ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.spartanops_event_notice_recipients(p_event uuid)
RETURNS TABLE (user_id uuid, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.user_id, u.email::text
  FROM public.spartanops_event_rsvps r
  JOIN auth.users u ON u.id = r.user_id
  WHERE r.event_id = p_event
    AND r.status IN ('going','maybe')
    AND r.notify_changes = true
    AND u.email IS NOT NULL
    AND u.email_confirmed_at IS NOT NULL
$$;
REVOKE EXECUTE ON FUNCTION public.spartanops_event_notice_recipients(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spartanops_event_notice_recipients(uuid) TO service_role;