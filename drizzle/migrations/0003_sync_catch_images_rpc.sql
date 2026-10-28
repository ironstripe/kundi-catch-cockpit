-- Atomare Bild-Synchronisation eines Catches (eine Transaktion, pro Catch serialisiert).
-- SECURITY INVOKER: bestehende RLS (can_edit) auf catch_images bleibt massgebend.
CREATE OR REPLACE FUNCTION public.sync_catch_images(
  _catch_id uuid,
  _images jsonb,
  _baseline_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_entry jsonb;
  v_index integer := 0;
  v_id uuid;
  v_path text;
  v_row public.catch_images;
  v_primary_id uuid;
  v_kept uuid[] := '{}';
  v_new_paths text[] := '{}';
  v_new_orders integer[] := '{}';
  v_removed_paths text[] := '{}';
  v_inserted integer := 0;
  v_updated integer := 0;
  v_removed integer := 0;
  v_count integer;
BEGIN
  IF NOT public.can_edit() THEN
    RAISE EXCEPTION 'Keine Berechtigung, Bilder dieses Catches zu ändern.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(_images) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Ungültige Bildliste.';
  END IF;

  -- Gleichzeitige Speichervorgänge desselben Catches nacheinander ausführen.
  PERFORM pg_advisory_xact_lock(hashtextextended('catch_images:' || _catch_id::text, 0));

  IF NOT EXISTS (SELECT 1 FROM public.catches WHERE id = _catch_id) THEN
    RAISE EXCEPTION 'Catch nicht gefunden.';
  END IF;

  -- Auflösen: bekannte Id (muss zu diesem Catch gehören) oder Pfad (Retry-Idempotenz).
  FOR v_entry IN SELECT value FROM jsonb_array_elements(_images) LOOP
    v_path := btrim(coalesce(v_entry->>'storage_path', ''));
    v_id := NULLIF(v_entry->>'id', '')::uuid;
    IF v_id IS NOT NULL THEN
      SELECT * INTO v_row FROM public.catch_images WHERE id = v_id AND catch_id = _catch_id;
      IF v_row.id IS NULL THEN
        RAISE EXCEPTION 'Bild gehört nicht zu diesem Catch.';
      END IF;
    ELSE
      IF v_path = '' OR v_path LIKE '/%' OR v_path LIKE '%..%' OR length(v_path) > 500 THEN
        RAISE EXCEPTION 'Ungültiger Bildpfad.';
      END IF;
      IF EXISTS (SELECT 1 FROM public.catch_images WHERE storage_path = v_path AND catch_id <> _catch_id) THEN
        RAISE EXCEPTION 'Bildpfad gehört zu einem anderen Catch.';
      END IF;
      v_row := NULL;
      SELECT * INTO v_row FROM public.catch_images
        WHERE catch_id = _catch_id AND storage_path = v_path
        ORDER BY created_at LIMIT 1;
    END IF;

    IF v_row.id IS NOT NULL THEN
      IF v_row.id = ANY (v_kept) THEN
        RAISE EXCEPTION 'Bild ist doppelt in der Liste.';
      END IF;
      v_kept := v_kept || v_row.id;
      IF v_index = 0 THEN v_primary_id := v_row.id; END IF;
    ELSE
      IF v_path = ANY (v_new_paths) THEN
        RAISE EXCEPTION 'Bild ist doppelt in der Liste.';
      END IF;
      v_new_paths := v_new_paths || v_path;
      v_new_orders := v_new_orders || v_index;
    END IF;
    v_index := v_index + 1;
    v_row := NULL;
  END LOOP;

  -- 1) Altes Hauptbild zuerst zurückstufen (eindeutiger Index pro Catch).
  IF v_index > 0 THEN
    UPDATE public.catch_images SET is_primary = false
      WHERE catch_id = _catch_id AND is_primary
        AND (v_primary_id IS NULL OR id <> v_primary_id);
  END IF;

  -- 2) Bewusst entfernte Baseline-Bilder löschen; Unbekannte bleiben.
  WITH gone AS (
    DELETE FROM public.catch_images
      WHERE catch_id = _catch_id
        AND id = ANY (coalesce(_baseline_ids, '{}'))
        AND NOT (id = ANY (v_kept))
      RETURNING storage_path
  )
  SELECT coalesce(array_agg(storage_path), '{}'), count(*) INTO v_removed_paths, v_removed FROM gone;

  -- Speicherobjekte nur freigeben, wenn kein verbleibender Datensatz sie nutzt.
  SELECT coalesce(array_agg(p), '{}') INTO v_removed_paths
    FROM unnest(v_removed_paths) AS p
    WHERE NOT EXISTS (SELECT 1 FROM public.catch_images ci WHERE ci.storage_path = p)
      AND NOT (p = ANY (v_new_paths));

  -- 3) Reihenfolge/Hauptbild der behaltenen Bilder.
  v_index := 0;
  FOR v_entry IN SELECT value FROM jsonb_array_elements(_images) LOOP
    v_id := NULLIF(v_entry->>'id', '')::uuid;
    IF v_id IS NULL THEN
      SELECT id INTO v_id FROM public.catch_images
        WHERE catch_id = _catch_id AND storage_path = btrim(v_entry->>'storage_path')
        ORDER BY created_at LIMIT 1;
    END IF;
    IF v_id IS NOT NULL THEN
      UPDATE public.catch_images
        SET is_primary = (v_index = 0), sort_order = v_index
        WHERE id = v_id AND (is_primary <> (v_index = 0) OR sort_order <> v_index);
      GET DIAGNOSTICS v_count = ROW_COUNT;
      v_updated := v_updated + v_count;
    END IF;
    v_index := v_index + 1;
  END LOOP;

  -- 4) Neue Bilder einfügen.
  FOR v_index IN 1 .. coalesce(array_length(v_new_paths, 1), 0) LOOP
    INSERT INTO public.catch_images (catch_id, storage_path, is_primary, sort_order)
      VALUES (_catch_id, v_new_paths[v_index], v_new_orders[v_index] = 0, v_new_orders[v_index]);
    v_inserted := v_inserted + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated,
    'removed', v_removed,
    'removed_paths', to_jsonb(v_removed_paths)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_catch_images(uuid, jsonb, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_catch_images(uuid, jsonb, uuid[]) TO authenticated, service_role;