ALTER TABLE public.spartanops_accounts
  ADD COLUMN IF NOT EXISTS active_lobby_id uuid REFERENCES public.spartanops_lobbies(id);
