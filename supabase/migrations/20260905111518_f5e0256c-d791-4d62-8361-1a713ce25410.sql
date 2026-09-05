CREATE POLICY "Active users read supplier offer files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'supplier-offers' AND public.is_active_user());

CREATE POLICY "Editors upload supplier offer files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'supplier-offers' AND public.can_edit());

CREATE POLICY "Editors update supplier offer files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'supplier-offers' AND public.can_edit())
  WITH CHECK (bucket_id = 'supplier-offers' AND public.can_edit());

CREATE POLICY "Admins delete supplier offer files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'supplier-offers' AND public.is_admin());