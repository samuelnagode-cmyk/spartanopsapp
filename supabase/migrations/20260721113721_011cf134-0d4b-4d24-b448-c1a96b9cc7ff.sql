ALTER TABLE public.spartanops_lobbies REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.spartanops_captures;
ALTER PUBLICATION supabase_realtime ADD TABLE public.spartanops_lobbies;