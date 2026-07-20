-- Switch view to run with definer privileges so the anon role does not need
-- direct SELECT on the underlying `registrations` table (which contains PII).
ALTER VIEW public.registrations_public SET (security_invoker = off);

-- Grant Data-API read access on the safe projection only.
GRANT SELECT ON public.registrations_public TO anon;
GRANT SELECT ON public.registrations_public TO authenticated;