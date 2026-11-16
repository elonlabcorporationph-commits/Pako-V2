DROP POLICY IF EXISTS "samples public read" ON public.samples;
REVOKE SELECT ON public.samples FROM anon;
GRANT ALL ON public.samples TO service_role;