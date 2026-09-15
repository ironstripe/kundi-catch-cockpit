-- 1. Musterprüfung am Catch -------------------------------------------------
ALTER TABLE public.catches
  ADD COLUMN IF NOT EXISTS article_number text,
  ADD COLUMN IF NOT EXISTS sample_check_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS sample_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS sample_checked_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS sample_check_note text;

ALTER TABLE public.catches
  ADD CONSTRAINT catches_sample_check_status_check
  CHECK (sample_check_status IN ('pending', 'passed', 'failed'));

COMMENT ON COLUMN public.catches.sample_check_status IS
  'Musterprüfung am aufgetauten Produkt: pending | passed | failed. Bestehende Catches starten bewusst auf pending.';

-- 2. Sounding-Tabellen ------------------------------------------------------
CREATE TABLE public.catch_review_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  catch_id uuid NOT NULL REFERENCES public.catches(id) ON DELETE CASCADE,
  round_number integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN ('requested', 'feedback_received', 'completed', 'outdated', 'cancelled')),
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_signature text NOT NULL DEFAULT '',
  requested_by uuid REFERENCES auth.users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  completed_by uuid REFERENCES auth.users(id),
  completed_at timestamptz,
  outdated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (catch_id, round_number)
);

GRANT SELECT, INSERT, UPDATE ON public.catch_review_rounds TO authenticated;
GRANT ALL ON public.catch_review_rounds TO service_role;
ALTER TABLE public.catch_review_rounds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aktive Nutzende lesen Sounding-Runden"
  ON public.catch_review_rounds FOR SELECT TO authenticated
  USING (public.is_active_user());
CREATE POLICY "Redaktion startet Sounding-Runden"
  ON public.catch_review_rounds FOR INSERT TO authenticated
  WITH CHECK (public.can_edit());
CREATE POLICY "Redaktion pflegt Sounding-Runden"
  ON public.catch_review_rounds FOR UPDATE TO authenticated
  USING (public.can_edit()) WITH CHECK (public.can_edit());

CREATE TABLE public.catch_review_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_round_id uuid NOT NULL REFERENCES public.catch_review_rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_round_id, user_id)
);

GRANT SELECT, INSERT, DELETE ON public.catch_review_recipients TO authenticated;
GRANT ALL ON public.catch_review_recipients TO service_role;
ALTER TABLE public.catch_review_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Aktive Nutzende lesen Prüfende"
  ON public.catch_review_recipients FOR SELECT TO authenticated
  USING (public.is_active_user());
CREATE POLICY "Redaktion wählt Prüfende"
  ON public.catch_review_recipients FOR INSERT TO authenticated
  WITH CHECK (public.can_edit());
CREATE POLICY "Redaktion entfernt Prüfende"
  ON public.catch_review_recipients FOR DELETE TO authenticated
  USING (public.can_edit());

CREATE TABLE public.catch_review_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_round_id uuid NOT NULL REFERENCES public.catch_review_rounds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision text NOT NULL CHECK (decision IN ('approved', 'question', 'stop')),
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_round_id, user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.catch_review_responses TO authenticated;
GRANT ALL ON public.catch_review_responses TO service_role;
ALTER TABLE public.catch_review_responses ENABLE ROW LEVEL SECURITY;

CREATE INDEX catch_review_rounds_catch_idx ON public.catch_review_rounds (catch_id, round_number DESC);
CREATE INDEX catch_review_recipients_user_idx ON public.catch_review_recipients (user_id);
CREATE INDEX catch_review_responses_round_idx ON public.catch_review_responses (review_round_id);

-- 3. Hilfsfunktionen -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_review_recipient(_round_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.catch_review_recipients r
    WHERE r.review_round_id = _round_id AND r.user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_review_round_open(_round_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.catch_review_rounds r
    WHERE r.id = _round_id AND r.status IN ('requested', 'feedback_received')
  )
$$;

CREATE POLICY "Aktive Nutzende lesen Rückmeldungen"
  ON public.catch_review_responses FOR SELECT TO authenticated
  USING (public.is_active_user());
CREATE POLICY "Prüfende erfassen ihre Rückmeldung"
  ON public.catch_review_responses FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.is_active_user()
    AND public.is_review_recipient(review_round_id, auth.uid())
    AND public.is_review_round_open(review_round_id)
  );
CREATE POLICY "Prüfende ändern ihre Rückmeldung"
  ON public.catch_review_responses FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    AND public.is_active_user()
    AND public.is_review_round_open(review_round_id)
  )
  WITH CHECK (user_id = auth.uid());

-- Deterministische Signatur aller im Sounding geprüften Werte.
CREATE OR REPLACE FUNCTION public.catch_source_signature(_catch_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT md5(concat_ws('|',
    c.product_name,
    coalesce(c.article_number, ''),
    coalesce(c.supplier_id::text, ''),
    coalesce(c.category_id::text, ''),
    c.temperature,
    coalesce(c.packaging, ''),
    coalesce(c.expiry_date::text, ''),
    c.purchase_quantity::text,
    c.quantity_unit,
    coalesce(c.purchase_price::text, ''),
    c.purchase_price_includes_vat::text,
    coalesce(c.purchase_vat_rate::text, ''),
    c.delivery_cost::text,
    c.delivery_included::text,
    c.delivery_cost_includes_vat::text,
    coalesce(c.delivery_vat_rate::text, ''),
    coalesce(c.catch_price::text, ''),
    coalesce(c.regular_price::text, ''),
    coalesce(c.vat_rate::text, ''),
    coalesce(c.available_from::text, ''),
    coalesce(c.available_until::text, ''),
    coalesce(c.handicap_reason, ''),
    coalesce(c.handicap_story, ''),
    c.sample_check_status,
    (SELECT coalesce(string_agg(cl.location_id::text, ',' ORDER BY cl.location_id::text), '')
       FROM public.catch_locations cl WHERE cl.catch_id = c.id),
    (SELECT coalesce(min(ci.storage_path), '')
       FROM public.catch_images ci WHERE ci.catch_id = c.id AND ci.is_primary)
  ))
  FROM public.catches c WHERE c.id = _catch_id
$$;

-- Markiert Runden als überholt, wenn geprüfte Werte nicht mehr passen.
CREATE OR REPLACE FUNCTION public.mark_review_rounds_outdated(_catch_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_signature text := public.catch_source_signature(_catch_id);
  v_round public.catch_review_rounds;
BEGIN
  FOR v_round IN
    SELECT * FROM public.catch_review_rounds
    WHERE catch_id = _catch_id
      AND status IN ('requested', 'feedback_received', 'completed')
      AND source_signature <> v_signature
  LOOP
    UPDATE public.catch_review_rounds
    SET status = 'outdated', outdated_at = now()
    WHERE id = v_round.id;

    INSERT INTO public.audit_events (entity_type, entity_id, action, payload, actor_id)
    VALUES ('catch', _catch_id, 'sounding_invalidated',
      jsonb_build_object(
        'previous', jsonb_build_object('status', v_round.status, 'round', v_round.round_number),
        'next', jsonb_build_object('status', 'outdated', 'round', v_round.round_number),
        'summary', 'Sounding-Runde ' || v_round.round_number || ' wurde überholt'),
      auth.uid());
  END LOOP;
END;
$$;

-- Setzt die Musterprüfung zurück, wenn sich die Produktidentität ändert.
CREATE OR REPLACE FUNCTION public.reset_sample_check(_catch_id uuid, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_catch public.catches;
BEGIN
  SELECT * INTO v_catch FROM public.catches WHERE id = _catch_id;
  IF v_catch.id IS NULL OR v_catch.sample_check_status = 'pending' THEN
    RETURN;
  END IF;

  UPDATE public.catches
  SET sample_check_status = 'pending',
      sample_checked_at = NULL,
      sample_checked_by = NULL,
      sample_check_note = NULL
  WHERE id = _catch_id;

  INSERT INTO public.audit_events (entity_type, entity_id, action, reason, payload, actor_id)
  VALUES ('catch', _catch_id, 'sample_check_invalidated', _reason,
    jsonb_build_object(
      'previous', jsonb_build_object(
        'sample_check_status', v_catch.sample_check_status,
        'sample_checked_at', v_catch.sample_checked_at,
        'sample_check_note', v_catch.sample_check_note),
      'next', jsonb_build_object('sample_check_status', 'pending'),
      'summary', 'Musterprüfung zurückgesetzt'),
    auth.uid());
END;
$$;

-- 4. Trigger auf Sounding-Runden -------------------------------------------
CREATE OR REPLACE FUNCTION public.prepare_review_round()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sample text;
BEGIN
  SELECT sample_check_status INTO v_sample FROM public.catches WHERE id = NEW.catch_id;
  IF v_sample IS DISTINCT FROM 'passed' THEN
    RAISE EXCEPTION 'Die Musterprüfung muss bestanden sein, bevor ein Sounding startet.';
  END IF;

  UPDATE public.catch_review_rounds
  SET status = 'cancelled'
  WHERE catch_id = NEW.catch_id AND status IN ('requested', 'feedback_received');

  NEW.round_number := coalesce(
    (SELECT max(round_number) FROM public.catch_review_rounds WHERE catch_id = NEW.catch_id), 0) + 1;
  NEW.source_signature := public.catch_source_signature(NEW.catch_id);
  NEW.status := 'requested';
  NEW.requested_by := coalesce(auth.uid(), NEW.requested_by);
  NEW.requested_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER prepare_review_round_insert
  BEFORE INSERT ON public.catch_review_rounds
  FOR EACH ROW EXECUTE FUNCTION public.prepare_review_round();

CREATE OR REPLACE FUNCTION public.guard_review_round_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sample text;
  v_responses integer;
  v_approved integer;
  v_stops integer;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status = 'completed' THEN
    IF auth.uid() IS NOT NULL AND NOT public.can_edit() THEN
      RAISE EXCEPTION 'Nur Administration und Redaktion können ein Sounding abschliessen.';
    END IF;
    IF OLD.status NOT IN ('requested', 'feedback_received') THEN
      RAISE EXCEPTION 'Diese Sounding-Runde ist nicht mehr offen.';
    END IF;

    SELECT sample_check_status INTO v_sample FROM public.catches WHERE id = NEW.catch_id;
    IF v_sample IS DISTINCT FROM 'passed' THEN
      RAISE EXCEPTION 'Die Musterprüfung ist nicht bestanden.';
    END IF;

    SELECT count(*), count(*) FILTER (WHERE decision = 'approved'), count(*) FILTER (WHERE decision = 'stop')
      INTO v_responses, v_approved, v_stops
    FROM public.catch_review_responses WHERE review_round_id = NEW.id;

    IF v_responses = 0 THEN
      RAISE EXCEPTION 'Es fehlt eine Rückmeldung.';
    END IF;
    IF v_approved = 0 THEN
      RAISE EXCEPTION 'Es braucht mindestens eine Zustimmung.';
    END IF;
    IF v_stops > 0 THEN
      RAISE EXCEPTION 'Eine Rückmeldung mit «Stopp» ist offen.';
    END IF;
    IF NEW.source_signature <> public.catch_source_signature(NEW.catch_id) THEN
      RAISE EXCEPTION 'Der Catch wurde nach dem Sounding verändert und muss erneut geprüft werden.';
    END IF;

    NEW.completed_by := coalesce(auth.uid(), NEW.completed_by);
    NEW.completed_at := now();

    INSERT INTO public.audit_events (entity_type, entity_id, action, payload, actor_id)
    VALUES ('catch', NEW.catch_id, 'sounding_completed',
      jsonb_build_object('next', jsonb_build_object('round', NEW.round_number),
        'summary', 'Sounding-Runde ' || NEW.round_number || ' abgeschlossen'), auth.uid());
  END IF;

  NEW.snapshot := OLD.snapshot;
  NEW.source_signature := OLD.source_signature;
  NEW.round_number := OLD.round_number;
  NEW.catch_id := OLD.catch_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_review_round_update
  BEFORE UPDATE ON public.catch_review_rounds
  FOR EACH ROW EXECUTE FUNCTION public.guard_review_round_update();

CREATE TRIGGER update_catch_review_rounds_updated_at
  BEFORE UPDATE ON public.catch_review_rounds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.audit_review_round_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.audit_events (entity_type, entity_id, action, payload, actor_id)
  VALUES ('catch', NEW.catch_id, 'sounding_started',
    jsonb_build_object('next', jsonb_build_object('round', NEW.round_number),
      'summary', 'Sounding-Runde ' || NEW.round_number || ' gestartet'), auth.uid());
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_review_round_insert
  AFTER INSERT ON public.catch_review_rounds
  FOR EACH ROW EXECUTE FUNCTION public.audit_review_round_insert();

-- 5. Trigger auf Rückmeldungen --------------------------------------------
CREATE OR REPLACE FUNCTION public.guard_review_response()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_catch uuid;
  v_round integer;
BEGIN
  IF NEW.decision IN ('question', 'stop') AND coalesce(btrim(NEW.comment), '') = '' THEN
    RAISE EXCEPTION 'Für «Rückfrage» und «Stopp» ist ein Kommentar erforderlich.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.user_id := OLD.user_id;
    NEW.review_round_id := OLD.review_round_id;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    IF NEW.user_id <> auth.uid() THEN
      RAISE EXCEPTION 'Eine Rückmeldung kann nur für die eigene Person erfasst werden.';
    END IF;
    IF NOT public.is_review_round_open(NEW.review_round_id) THEN
      RAISE EXCEPTION 'Diese Sounding-Runde ist nicht mehr offen.';
    END IF;
    IF NOT public.is_review_recipient(NEW.review_round_id, auth.uid()) THEN
      RAISE EXCEPTION 'Diese Person ist für dieses Sounding nicht als Prüfende ausgewählt.';
    END IF;
  END IF;

  SELECT catch_id, round_number INTO v_catch, v_round
  FROM public.catch_review_rounds WHERE id = NEW.review_round_id;

  UPDATE public.catch_review_rounds
  SET status = 'feedback_received'
  WHERE id = NEW.review_round_id AND status = 'requested';

  INSERT INTO public.audit_events (entity_type, entity_id, action, payload, actor_id)
  VALUES ('catch', v_catch,
    CASE WHEN TG_OP = 'INSERT' THEN 'review_feedback_submitted' ELSE 'review_feedback_updated' END,
    jsonb_build_object('next', jsonb_build_object('round', v_round, 'decision', NEW.decision),
      'summary', 'Rückmeldung: ' || NEW.decision), auth.uid());

  RETURN NEW;
END;
$$;

CREATE TRIGGER guard_review_response_write
  BEFORE INSERT OR UPDATE ON public.catch_review_responses
  FOR EACH ROW EXECUTE FUNCTION public.guard_review_response();

CREATE TRIGGER update_catch_review_responses_updated_at
  BEFORE UPDATE ON public.catch_review_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.audit_review_recipient()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_catch uuid;
BEGIN
  SELECT catch_id INTO v_catch FROM public.catch_review_rounds WHERE id = NEW.review_round_id;
  INSERT INTO public.audit_events (entity_type, entity_id, action, payload, actor_id)
  VALUES ('catch', v_catch, 'reviewer_assigned',
    jsonb_build_object('next', jsonb_build_object('user_id', NEW.user_id),
      'summary', 'Prüfende Person zugewiesen'), auth.uid());
  RETURN NEW;
END;
$$;

CREATE TRIGGER audit_review_recipient_insert
  AFTER INSERT ON public.catch_review_recipients
  FOR EACH ROW EXECUTE FUNCTION public.audit_review_recipient();

-- 6. Musterprüfung: Audit und Rücksetzung bei Identitätswechsel -------------
CREATE OR REPLACE FUNCTION public.handle_catch_identity_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.sample_check_status IS DISTINCT FROM OLD.sample_check_status THEN
    IF NEW.sample_check_status IN ('passed', 'failed') THEN
      IF auth.uid() IS NOT NULL AND NOT public.can_edit() THEN
        RAISE EXCEPTION 'Nur Administration und Redaktion können die Musterprüfung erfassen.';
      END IF;
      NEW.sample_checked_by := coalesce(auth.uid(), NEW.sample_checked_by);
      NEW.sample_checked_at := now();
    END IF;

    INSERT INTO public.audit_events (entity_type, entity_id, action, reason, payload, actor_id)
    VALUES ('catch', NEW.id,
      CASE
        WHEN NEW.sample_check_status = 'passed' THEN 'sample_check_passed'
        WHEN NEW.sample_check_status = 'failed' THEN 'sample_check_failed'
        ELSE 'sample_check_invalidated'
      END,
      NEW.sample_check_note,
      jsonb_build_object(
        'previous', jsonb_build_object('sample_check_status', OLD.sample_check_status),
        'next', jsonb_build_object('sample_check_status', NEW.sample_check_status),
        'summary', 'Musterprüfung: ' || NEW.sample_check_status),
      auth.uid());
    RETURN NEW;
  END IF;

  -- Produktidentität geändert: Musterprüfung wird ungültig.
  IF OLD.sample_check_status <> 'pending' AND (
       NEW.product_name IS DISTINCT FROM OLD.product_name
    OR NEW.article_number IS DISTINCT FROM OLD.article_number
    OR NEW.supplier_id IS DISTINCT FROM OLD.supplier_id
    OR NEW.category_id IS DISTINCT FROM OLD.category_id
    OR NEW.temperature IS DISTINCT FROM OLD.temperature
    OR NEW.packaging IS DISTINCT FROM OLD.packaging
    OR NEW.expiry_date IS DISTINCT FROM OLD.expiry_date
  ) THEN
    INSERT INTO public.audit_events (entity_type, entity_id, action, reason, payload, actor_id)
    VALUES ('catch', NEW.id, 'sample_check_invalidated',
      'Produktangaben wurden nach der Musterprüfung geändert.',
      jsonb_build_object(
        'previous', jsonb_build_object(
          'sample_check_status', OLD.sample_check_status,
          'sample_checked_at', OLD.sample_checked_at,
          'sample_check_note', OLD.sample_check_note),
        'next', jsonb_build_object('sample_check_status', 'pending'),
        'summary', 'Musterprüfung zurückgesetzt'),
      auth.uid());

    NEW.sample_check_status := 'pending';
    NEW.sample_checked_at := NULL;
    NEW.sample_checked_by := NULL;
    NEW.sample_check_note := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER handle_catch_identity_change_update
  BEFORE UPDATE ON public.catches
  FOR EACH ROW EXECUTE FUNCTION public.handle_catch_identity_change();

CREATE OR REPLACE FUNCTION public.sync_review_rounds_after_catch_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.mark_review_rounds_outdated(NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_review_rounds_after_catch_update
  AFTER UPDATE ON public.catches
  FOR EACH ROW EXECUTE FUNCTION public.sync_review_rounds_after_catch_change();

CREATE OR REPLACE FUNCTION public.sync_review_rounds_after_image_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_catch uuid := coalesce(NEW.catch_id, OLD.catch_id);
BEGIN
  PERFORM public.reset_sample_check(v_catch, 'Das Produktbild wurde nach der Musterprüfung geändert.');
  PERFORM public.mark_review_rounds_outdated(v_catch);
  RETURN NULL;
END;
$$;

CREATE TRIGGER sync_review_rounds_after_image_change
  AFTER INSERT OR UPDATE OR DELETE ON public.catch_images
  FOR EACH ROW EXECUTE FUNCTION public.sync_review_rounds_after_image_change();

CREATE OR REPLACE FUNCTION public.sync_review_rounds_after_location_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.mark_review_rounds_outdated(coalesce(NEW.catch_id, OLD.catch_id));
  RETURN NULL;
END;
$$;

CREATE TRIGGER sync_review_rounds_after_location_change
  AFTER INSERT OR DELETE ON public.catch_locations
  FOR EACH ROW EXECUTE FUNCTION public.sync_review_rounds_after_location_change();

-- 7. «Bereit» nur mit Musterprüfung und abgeschlossenem Sounding ------------
CREATE OR REPLACE FUNCTION public.enforce_catch_status_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  allowed BOOLEAN := FALSE;
  v_round public.catch_review_rounds;
  v_responses integer;
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

  IF NEW.status = 'ready' THEN
    IF NEW.sample_check_status = 'pending' THEN
      RAISE EXCEPTION 'Die Musterprüfung ist noch ausstehend.';
    END IF;
    IF NEW.sample_check_status = 'failed' THEN
      RAISE EXCEPTION 'Die Musterprüfung wurde nicht bestanden.';
    END IF;

    SELECT * INTO v_round FROM public.catch_review_rounds
    WHERE catch_id = NEW.id ORDER BY round_number DESC LIMIT 1;

    IF v_round.id IS NULL THEN
      RAISE EXCEPTION 'Das Sounding wurde noch nicht gestartet.';
    END IF;

    SELECT count(*) INTO v_responses
    FROM public.catch_review_responses WHERE review_round_id = v_round.id;

    IF v_round.status = 'outdated' THEN
      RAISE EXCEPTION 'Der Catch wurde nach dem Sounding verändert und muss erneut geprüft werden.';
    END IF;
    IF v_round.status <> 'completed' AND v_responses = 0 THEN
      RAISE EXCEPTION 'Es fehlt eine Rückmeldung.';
    END IF;
    IF v_round.status <> 'completed' THEN
      RAISE EXCEPTION 'Das Sounding wurde noch nicht abgeschlossen.';
    END IF;
    IF v_round.source_signature <> public.catch_source_signature(NEW.id) THEN
      RAISE EXCEPTION 'Der Catch wurde nach dem Sounding verändert und muss erneut geprüft werden.';
    END IF;
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