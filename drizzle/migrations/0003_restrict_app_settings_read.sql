DROP POLICY IF EXISTS "settings public read" ON public.app_settings;
REVOKE SELECT ON public.app_settings FROM anon;