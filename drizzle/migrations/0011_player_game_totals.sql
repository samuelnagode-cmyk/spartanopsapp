CREATE OR REPLACE FUNCTION public.spartanops_player_game_totals(p_user uuid)
RETURNS TABLE(games integer, wins integer, captures integer, deaths integer, mvps integer)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT count(*)::int, count(*) FILTER (WHERE team_won)::int,
         COALESCE(sum(captures),0)::int, COALESCE(sum(deaths),0)::int,
         count(*) FILTER (WHERE is_mvp)::int
    FROM public.spartanops_match_results WHERE player_user_id = p_user;
$$;
REVOKE ALL ON FUNCTION public.spartanops_player_game_totals(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.spartanops_player_game_totals(uuid) TO service_role;