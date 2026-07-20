
DO $$
DECLARE
  fn text;
  sig text;
  fns text[] := ARRAY[
    'verify_field_password(text,text)',
    'update_updated_at_column()',
    'spartanops_acknowledge_team_change(text,text)',
    'spartanops_apply_capture(text,integer,text)',
    'spartanops_delete_lobby(uuid)',
    'spartanops_hash_password(text)',
    'spartanops_verify_lobby_password(uuid,text,text)',
    'spartanops_delete_lobby_players(text)',
    'spartanops_bootstrap_game_state()',
    'spartanops_get_field_map(text,text,text)'
  ];
BEGIN
  FOREACH sig IN ARRAY fns LOOP
    fn := 'public.' || sig;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;
