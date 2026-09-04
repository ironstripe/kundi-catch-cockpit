CREATE TABLE IF NOT EXISTS public.application_setting_versions (
  id uuid primary key default gen_random_uuid(),
  key text not null,
  value jsonb not null,
  version integer not null,
  archived_at timestamptz not null default now(),
  archived_by uuid,
  summary text
);

GRANT SELECT ON public.application_setting_versions TO authenticated;
GRANT ALL ON public.application_setting_versions TO service_role;
ALTER TABLE public.application_setting_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins lesen Einstellungsversionen" ON public.application_setting_versions;
CREATE POLICY "Admins lesen Einstellungsversionen"
ON public.application_setting_versions FOR SELECT TO authenticated
USING (public.is_admin());

INSERT INTO public.application_setting_versions (key, value, version, summary)
SELECT key, value, version, 'Version vor der Markenarchitektur-Aktualisierung'
FROM public.application_settings
WHERE key IN ('whatsapp_template', 'brand_logo');

UPDATE public.application_settings
SET version = version + 1, updated_at = now()
WHERE key = 'whatsapp_template';

INSERT INTO public.application_settings (key, value, version)
VALUES ('brand_icon', '{"path": null, "file_name": null, "mime_type": null, "size": null}'::jsonb, 1)
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.audit_events (entity_type, entity_id, action, payload, reason)
VALUES (
  'settings',
  md5('whatsapp_template')::uuid,
  'template_updated',
  jsonb_build_object(
    'summary', 'Brand architecture and WhatsApp default template updated',
    'key', 'whatsapp_template',
    'previous_purpose', 'Schnell sein. Gut essen. Food Waste vermeiden.',
    'next_purpose', 'Gut essen. Food Waste vermeiden.'
  ),
  'Brand architecture and WhatsApp default template updated'
);