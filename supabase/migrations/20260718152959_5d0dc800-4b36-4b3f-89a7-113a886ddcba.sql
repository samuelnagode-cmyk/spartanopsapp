ALTER TABLE public.spartanops_checkin_secrets
  ADD COLUMN IF NOT EXISTS respawn_unlock_at timestamp with time zone;

COMMENT ON COLUMN public.spartanops_checkin_secrets.respawn_unlock_at IS 'Server-authoritative timestamp until which a player must remain in respawn lock before rejoining the mission HUD.';