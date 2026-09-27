-- Remove the anon role's full access to spartanops_accounts.
-- This is a private account-identity table: signed-out visitors have no
-- legitimate use for it, and the RLS policies already scope it to
-- authenticated users only. The authenticated and service_role grants stay.
REVOKE ALL ON public.spartanops_accounts FROM anon;
