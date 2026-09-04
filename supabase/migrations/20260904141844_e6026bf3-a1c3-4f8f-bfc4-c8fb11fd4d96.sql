CREATE POLICY "Admins can read exports" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'exports' AND public.is_admin());

CREATE POLICY "Admins can upload exports" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'exports' AND public.is_admin());

CREATE POLICY "Admins can delete exports" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'exports' AND public.is_admin());