ALTER TABLE public.spartanops_captures REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.spartanops_captures;