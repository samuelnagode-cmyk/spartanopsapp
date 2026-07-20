ALTER TABLE public.spartanops_checkins REPLICA IDENTITY FULL;
ALTER TABLE public.spartanops_game_state REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.spartanops_checkins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.spartanops_game_state;