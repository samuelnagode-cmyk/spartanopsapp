CREATE POLICY "service role manages mission archives"
ON public.spartanops_archived_missions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);