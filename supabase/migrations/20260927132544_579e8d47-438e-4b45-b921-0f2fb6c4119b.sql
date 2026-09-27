-- New tables in public get no anon privileges by default; grant explicitly when needed.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;

-- Unused by any client/server code; no anon use case.
REVOKE ALL ON public.spartanops_field_secrets FROM anon;
REVOKE ALL ON public.event_registrations FROM anon;
