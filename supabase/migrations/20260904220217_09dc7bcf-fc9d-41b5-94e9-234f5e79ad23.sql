ALTER TABLE public.catches
  ADD COLUMN IF NOT EXISTS instagram_selected boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS instagram_caption text,
  ADD COLUMN IF NOT EXISTS instagram_asset_path text,
  ADD COLUMN IF NOT EXISTS instagram_status text NOT NULL DEFAULT 'not_selected',
  ADD COLUMN IF NOT EXISTS instagram_approved_by uuid,
  ADD COLUMN IF NOT EXISTS instagram_approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS instagram_publish_at timestamptz,
  ADD COLUMN IF NOT EXISTS instagram_published_at timestamptz,
  ADD COLUMN IF NOT EXISTS instagram_media_id text,
  ADD COLUMN IF NOT EXISTS instagram_permalink text,
  ADD COLUMN IF NOT EXISTS instagram_error text,
  ADD COLUMN IF NOT EXISTS instagram_attempt integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS instagram_idempotency_key text;

ALTER TABLE public.catches
  DROP CONSTRAINT IF EXISTS catches_instagram_status_check;
ALTER TABLE public.catches
  ADD CONSTRAINT catches_instagram_status_check
  CHECK (instagram_status IN ('not_selected','draft','ready','publishing','published','failed'));

CREATE UNIQUE INDEX IF NOT EXISTS catches_instagram_idempotency_key_idx
  ON public.catches (instagram_idempotency_key)
  WHERE instagram_idempotency_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.protect_instagram_result_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('role', true) = 'service_role' OR auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  NEW.instagram_status := CASE
    WHEN NEW.instagram_status IN ('publishing','published','failed')
      AND NEW.instagram_status IS DISTINCT FROM OLD.instagram_status
    THEN OLD.instagram_status
    ELSE NEW.instagram_status
  END;
  NEW.instagram_media_id := OLD.instagram_media_id;
  NEW.instagram_permalink := OLD.instagram_permalink;
  NEW.instagram_published_at := OLD.instagram_published_at;
  NEW.instagram_approved_by := OLD.instagram_approved_by;
  NEW.instagram_approved_at := OLD.instagram_approved_at;
  NEW.instagram_attempt := OLD.instagram_attempt;
  NEW.instagram_idempotency_key := OLD.instagram_idempotency_key;

  IF NEW.instagram_selected AND NOT OLD.instagram_selected AND OLD.published_at IS NULL THEN
    RAISE EXCEPTION 'Instagram ist erst nach der WhatsApp-Publikation verfuegbar.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_instagram_result_fields ON public.catches;
CREATE TRIGGER protect_instagram_result_fields
  BEFORE UPDATE ON public.catches
  FOR EACH ROW EXECUTE FUNCTION public.protect_instagram_result_fields();

INSERT INTO public.application_settings (key, value)
VALUES ('instagram', jsonb_build_object(
  'enabled', false,
  'whatsapp_group_url', '',
  'call_to_action', 'Die aktuellen Kundi Catches gibt es zuerst in unserer WhatsApp-Gruppe.' || chr(10) || 'Jetzt ueber den Link in der Bio beitreten.',
  'default_publish_time', 'now',
  'default_publish_hour', '09:00'
))
ON CONFLICT (key) DO NOTHING;