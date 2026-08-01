ALTER TABLE public.spartanops_checkins
  ADD COLUMN IF NOT EXISTS operator_type text;

ALTER TABLE public.spartanops_checkins
  DROP CONSTRAINT IF EXISTS spartanops_checkins_operator_type_check;

ALTER TABLE public.spartanops_checkins
  ADD CONSTRAINT spartanops_checkins_operator_type_check
  CHECK (operator_type IS NULL OR operator_type IN ('AEG', 'SNIPER', 'DMR', 'PUMP'));

COMMENT ON COLUMN public.spartanops_checkins.operator_type IS 'Player-selected airsoft operator platform: AEG, SNIPER, DMR, or PUMP.';