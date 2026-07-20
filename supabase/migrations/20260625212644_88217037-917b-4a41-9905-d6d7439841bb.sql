
ALTER VIEW public.registrations_public SET (security_invoker = off);
GRANT SELECT ON public.registrations_public TO anon, authenticated;
GRANT INSERT ON public.registrations TO anon, authenticated;
GRANT ALL ON public.registrations TO service_role;
