ALTER TABLE public.spartanops_events
  ADD COLUMN IF NOT EXISTS schedule_changed_at timestamptz NULL;

CREATE TABLE public.spartanops_event_rsvps (
  event_id uuid NOT NULL REFERENCES public.spartanops_events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.spartanops_players(user_id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('going','maybe')),
  phone_share text NOT NULL DEFAULT 'none' CHECK (phone_share IN ('none','organiser','attendees')),
  ride_role text NOT NULL DEFAULT 'none' CHECK (ride_role IN ('none','driver','rider')),
  ride_from text NULL CHECK (ride_from IS NULL OR char_length(ride_from) BETWEEN 2 AND 60),
  ride_seats integer NULL CHECK (ride_seats IS NULL OR ride_seats BETWEEN 1 AND 8),
  ride_note text NULL CHECK (ride_note IS NULL OR char_length(ride_note) <= 120),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id),
  CONSTRAINT rsvp_ride_needs_town CHECK (ride_role = 'none' OR ride_from IS NOT NULL),
  CONSTRAINT rsvp_driver_has_seats CHECK ((ride_role = 'driver') = (ride_seats IS NOT NULL)),
  CONSTRAINT rsvp_ride_needs_contact CHECK (ride_role = 'none' OR phone_share = 'attendees')
);
CREATE INDEX spartanops_event_rsvps_user_idx ON public.spartanops_event_rsvps (user_id);
ALTER TABLE public.spartanops_event_rsvps ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.spartanops_event_rsvps FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.spartanops_event_rsvps TO service_role;

CREATE OR REPLACE FUNCTION public.spartanops_rsvp_set(
  p_event uuid, p_user uuid, p_status text, p_phone_share text,
  p_ride_role text, p_ride_from text, p_ride_seats integer, p_ride_note text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_capacity integer; v_status text; v_starts timestamptz; v_ends timestamptz;
  v_going integer; v_prev text;
BEGIN
  SELECT capacity, status, starts_at, ends_at INTO v_capacity, v_status, v_starts, v_ends
    FROM public.spartanops_events WHERE id = p_event FOR UPDATE;
  IF NOT FOUND OR v_status = 'hidden' THEN RETURN 'not_found'; END IF;
  IF v_status <> 'published' THEN RETURN 'event_closed'; END IF;
  IF COALESCE(v_ends, v_starts + interval '6 hours') < now() THEN RETURN 'event_over'; END IF;
  SELECT status INTO v_prev FROM public.spartanops_event_rsvps WHERE event_id = p_event AND user_id = p_user;
  IF p_status = 'going' AND v_capacity IS NOT NULL AND v_prev IS DISTINCT FROM 'going' THEN
    SELECT count(*) INTO v_going FROM public.spartanops_event_rsvps WHERE event_id = p_event AND status = 'going';
    IF v_going >= v_capacity THEN RETURN 'full'; END IF;
  END IF;
  INSERT INTO public.spartanops_event_rsvps AS r
    (event_id, user_id, status, phone_share, ride_role, ride_from, ride_seats, ride_note)
  VALUES (p_event, p_user, p_status, p_phone_share, p_ride_role, p_ride_from, p_ride_seats, p_ride_note)
  ON CONFLICT (event_id, user_id) DO UPDATE SET
    status = EXCLUDED.status, phone_share = EXCLUDED.phone_share, ride_role = EXCLUDED.ride_role,
    ride_from = EXCLUDED.ride_from, ride_seats = EXCLUDED.ride_seats, ride_note = EXCLUDED.ride_note,
    updated_at = now();
  RETURN 'ok';
END $$;
REVOKE EXECUTE ON FUNCTION public.spartanops_rsvp_set(uuid, uuid, text, text, text, text, integer, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spartanops_rsvp_set(uuid, uuid, text, text, text, text, integer, text) TO service_role;