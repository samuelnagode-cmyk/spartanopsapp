ALTER TABLE public.spartanops_players
  ADD COLUMN IF NOT EXISTS contact_methods text[] NOT NULL DEFAULT ARRAY['call','viber','whatsapp']::text[];
ALTER TABLE public.spartanops_players
  ADD CONSTRAINT spartanops_players_contact_methods_check
  CHECK (contact_methods <@ ARRAY['call','sms','viber','whatsapp']::text[] AND cardinality(contact_methods) >= 1);