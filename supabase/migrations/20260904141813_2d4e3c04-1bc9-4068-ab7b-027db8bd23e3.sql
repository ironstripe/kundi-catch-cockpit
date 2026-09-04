CREATE OR REPLACE FUNCTION public.enforce_catch_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed BOOLEAN := FALSE;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  allowed := (OLD.status, NEW.status) IN (
    ('draft', 'ready'),
    ('ready', 'draft'),
    ('ready', 'published'),
    ('published', 'closed'),
    ('published', 'cancelled'),
    ('closed', 'published')
  );

  IF NOT allowed THEN
    RAISE EXCEPTION 'Dieser Statuswechsel ist nicht zulässig.';
  END IF;

  IF NEW.status = 'cancelled' AND coalesce(btrim(NEW.cancellation_reason), '') = '' THEN
    RAISE EXCEPTION 'Für den Abbruch ist ein Grund erforderlich.';
  END IF;

  IF OLD.status = 'closed' AND NEW.status = 'published'
     AND coalesce(btrim(NEW.reopen_reason), '') = '' THEN
    RAISE EXCEPTION 'Für die Wiederöffnung ist ein Grund erforderlich.';
  END IF;

  INSERT INTO public.audit_events (entity_type, entity_id, action, reason, payload, actor_id)
  VALUES (
    'catch',
    NEW.id,
    'status_changed',
    CASE
      WHEN NEW.status = 'cancelled' THEN NEW.cancellation_reason
      WHEN NEW.status = 'published' AND OLD.status = 'closed' THEN NEW.reopen_reason
      ELSE NULL
    END,
    jsonb_build_object(
      'previous', jsonb_build_object('status', OLD.status),
      'next', jsonb_build_object('status', NEW.status),
      'summary', concat(OLD.status, ' → ', NEW.status)
    ),
    auth.uid()
  );

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.enforce_catch_status_transition() FROM authenticated, anon;

DROP TRIGGER IF EXISTS enforce_catch_status_transition_update ON public.catches;
CREATE TRIGGER enforce_catch_status_transition_update
BEFORE UPDATE ON public.catches
FOR EACH ROW EXECUTE FUNCTION public.enforce_catch_status_transition();

CREATE TABLE public.backup_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  succeeded_at TIMESTAMPTZ,
  error_summary TEXT,
  actor_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.backup_runs TO authenticated;
GRANT ALL ON public.backup_runs TO service_role;

ALTER TABLE public.backup_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read backup runs" ON public.backup_runs
FOR SELECT TO authenticated
USING (public.is_admin());

CREATE INDEX IF NOT EXISTS catches_status_created_at_idx ON public.catches (status, created_at DESC);
CREATE INDEX IF NOT EXISTS catches_closed_at_idx ON public.catches (closed_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_created_at_idx ON public.audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_events_entity_idx ON public.audit_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS catch_images_catch_id_idx ON public.catch_images (catch_id);
CREATE INDEX IF NOT EXISTS catch_locations_catch_id_idx ON public.catch_locations (catch_id);