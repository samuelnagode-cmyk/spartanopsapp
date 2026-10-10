CREATE TABLE public.spartanops_field_plans (
  account_id uuid PRIMARY KEY REFERENCES public.spartanops_accounts(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free','founding','pro')),
  plan_until date NULL,
  note text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.spartanops_field_plans TO authenticated;
GRANT ALL ON public.spartanops_field_plans TO service_role;
ALTER TABLE public.spartanops_field_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Marshals read own plan" ON public.spartanops_field_plans
  FOR SELECT TO authenticated USING (account_id = auth.uid());

CREATE TABLE public.spartanops_plan_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.spartanops_accounts(id) ON DELETE CASCADE,
  lobby_id uuid NULL,
  kind text NOT NULL CHECK (kind IN ('cap_hit','game_started')),
  detail jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.spartanops_plan_events TO service_role;
ALTER TABLE public.spartanops_plan_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX spartanops_plan_events_account_idx ON public.spartanops_plan_events (account_id, created_at DESC);
CREATE INDEX spartanops_plan_events_kind_idx ON public.spartanops_plan_events (kind, created_at);

INSERT INTO public.spartanops_field_plans (account_id, plan, plan_until, note)
SELECT id, 'founding', DATE '2027-03-31', 'beta tester' FROM public.spartanops_accounts
ON CONFLICT (account_id) DO NOTHING;