
CREATE INDEX IF NOT EXISTS spartanops_lobbies_created_at_idx ON public.spartanops_lobbies (created_at DESC);
CREATE INDEX IF NOT EXISTS spartanops_lobbies_state_idx ON public.spartanops_lobbies (state);
CREATE INDEX IF NOT EXISTS spartanops_lobbies_published_idx ON public.spartanops_lobbies (published);
CREATE INDEX IF NOT EXISTS spartanops_captures_field_captured_idx ON public.spartanops_captures (field_id, captured_at DESC);
CREATE INDEX IF NOT EXISTS spartanops_captures_team_idx ON public.spartanops_captures (team);
CREATE INDEX IF NOT EXISTS spartanops_checkins_field_created_idx ON public.spartanops_checkins (field_id, created_at DESC);
CREATE INDEX IF NOT EXISTS spartanops_checkins_team_idx ON public.spartanops_checkins (assigned_team);
