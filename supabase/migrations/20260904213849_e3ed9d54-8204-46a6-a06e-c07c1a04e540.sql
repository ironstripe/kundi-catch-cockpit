-- 1. Passwortwechsel-Pflicht ------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- 2. Privilegierte Profilfelder gegen Selbstbedienung schützen ---------------
CREATE OR REPLACE FUNCTION public.guard_profile_privileges()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Service-Role (Benutzerverwaltung) hat keine auth.uid() und darf alles.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.active IS DISTINCT FROM OLD.active
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.must_change_password IS DISTINCT FROM OLD.must_change_password THEN
    RAISE EXCEPTION 'Diese Profilfelder können nur über die Benutzerverwaltung geändert werden.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_privileges_update ON public.profiles;
CREATE TRIGGER guard_profile_privileges_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_privileges();

-- 3. Wiederöffnen und Abbrechen nur für aktive Administratoren --------------
CREATE OR REPLACE FUNCTION public.enforce_catch_status_transition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- 4. Speicherregeln für Catch-Bilder nach Rolle -----------------------------
DROP POLICY IF EXISTS "Authenticated can read catch images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload catch images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update catch images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete catch images" ON storage.objects;

CREATE POLICY "Active users can read catch images"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'catch-images' AND public.is_active_user());

CREATE POLICY "Editors can upload catch images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'catch-images' AND public.can_edit());

CREATE POLICY "Editors can update catch images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'catch-images' AND public.can_edit())
  WITH CHECK (bucket_id = 'catch-images' AND public.can_edit());

CREATE POLICY "Editors can delete catch images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'catch-images' AND public.can_edit());

-- 5. Änderungsprotokoll: handelnde Person serverseitig setzen ---------------
CREATE OR REPLACE FUNCTION public.set_audit_actor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL THEN
    NEW.actor_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_audit_actor_insert ON public.audit_events;
CREATE TRIGGER set_audit_actor_insert
  BEFORE INSERT ON public.audit_events
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_actor();

-- 6. Erlaubte Protokoll-Aktionen erweitern ----------------------------------
ALTER TABLE public.audit_events DROP CONSTRAINT IF EXISTS audit_events_action_valid;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_action_valid CHECK (
  action = ANY (ARRAY[
    'created','updated','status_changed','published','deleted','closed',
    'reconciliation_changed','reopened','cancelled','calculation_decision',
    'critical_calculation_confirmed','user_created','user_updated','role_changed',
    'user_activated','user_deactivated','password_reset_sent','user_deleted',
    'initial_password_set','supplier_created','supplier_updated','location_created',
    'location_updated','category_created','category_updated','thresholds_updated',
    'template_updated','logo_replaced','settings_reset','export_created','backup_sent'
  ])
);