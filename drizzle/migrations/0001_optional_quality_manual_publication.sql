CREATE OR REPLACE FUNCTION public.enforce_catch_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  allowed BOOLEAN := FALSE;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  allowed := (OLD.status, NEW.status) IN (
    ('draft', 'ready'),
    ('draft', 'published'),
    ('ready', 'draft'),
    ('ready', 'published'),
    ('published', 'closed'),
    ('published', 'cancelled'),
    ('closed', 'published')
  );

  IF NOT allowed THEN
    RAISE EXCEPTION 'Dieser Statuswechsel ist nicht zulässig.';
  END IF;

  -- Musterprüfung und Sounding bleiben optionale, unveränderte Aufzeichnungen.
  IF NEW.status = 'cancelled' THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Nur Administratoren können einen Catch abbrechen.';
    END IF;
    IF coalesce(btrim(NEW.cancellation_reason), '') = '' THEN
      RAISE EXCEPTION 'Für den Abbruch ist ein Grund erforderlich.';
    END IF;
  END IF;

  IF OLD.status = 'closed' AND NEW.status = 'published' THEN
    IF auth.uid() IS NOT NULL AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Nur Administratoren können einen abgeschlossenen Catch wieder öffnen.';
    END IF;
    IF coalesce(btrim(NEW.reopen_reason), '') = '' THEN
      RAISE EXCEPTION 'Für die Wiederöffnung ist ein Grund erforderlich.';
    END IF;
  END IF;

  INSERT INTO public.audit_events (entity_type, entity_id, action, reason, payload, actor_id)
  VALUES (
    'catch', NEW.id, 'status_changed',
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
$function$;

-- Ein manuell publizierter Entwurf darf noch keine Einkaufsmenge haben.
-- Die positive Menge für Bereit/Abschluss bleibt unverändert erforderlich.
ALTER TABLE public.catches DROP CONSTRAINT catches_quantity_positive_when_ready;
ALTER TABLE public.catches ADD CONSTRAINT catches_quantity_positive_when_ready
CHECK (status IN ('draft', 'published', 'cancelled') OR purchase_quantity > 0);
