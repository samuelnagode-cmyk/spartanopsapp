GRANT DELETE ON public.registrations TO anon, authenticated;
CREATE POLICY "Public can cancel registration" ON public.registrations FOR DELETE TO anon, authenticated USING (true);