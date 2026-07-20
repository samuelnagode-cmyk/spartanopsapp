
-- Spartacus GPS Anti-Cheat foundation

-- 1) Extend captures with GPS coords + suspicious flag + review state
ALTER TABLE public.spartanops_captures
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision,
  ADD COLUMN IF NOT EXISTS suspicious boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS spartacus_status text NOT NULL DEFAULT 'ok',
  ADD COLUMN IF NOT EXISTS distance_m double precision;

-- 2) QR code anchor coordinates (first-scan wins)
CREATE TABLE IF NOT EXISTS public.spartanops_qr_anchors (
  field_id text NOT NULL,
  point_number integer NOT NULL CHECK (point_number BETWEEN 1 AND 5),
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  anchored_at timestamptz NOT NULL DEFAULT now(),
  anchored_by_callsign text,
  PRIMARY KEY (field_id, point_number)
);

GRANT SELECT ON public.spartanops_qr_anchors TO anon, authenticated;
GRANT ALL   ON public.spartanops_qr_anchors TO service_role;
ALTER TABLE public.spartanops_qr_anchors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qr anchors public read" ON public.spartanops_qr_anchors;
CREATE POLICY "qr anchors public read"
  ON public.spartanops_qr_anchors
  FOR SELECT TO anon, authenticated
  USING (true);

-- 3) Realtime for anchors + captures (captures already added historically)
ALTER TABLE public.spartanops_qr_anchors REPLICA IDENTITY FULL;
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.spartanops_qr_anchors;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END$$;
