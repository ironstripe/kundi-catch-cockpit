-- 1. Neue Felder ---------------------------------------------------------
ALTER TABLE public.catches
  ADD COLUMN IF NOT EXISTS packaging TEXT,
  ADD COLUMN IF NOT EXISTS expiry_date DATE,
  ADD COLUMN IF NOT EXISTS delivery_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivery_included BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS handicap_reason TEXT;

-- 2. Verfügbarkeit mit Uhrzeit -------------------------------------------
ALTER TABLE public.catches DROP CONSTRAINT IF EXISTS catches_availability_order;
ALTER TABLE public.catches
  ALTER COLUMN available_from TYPE TIMESTAMPTZ
    USING (available_from::timestamp AT TIME ZONE 'Europe/Zurich'),
  ALTER COLUMN available_until TYPE TIMESTAMPTZ
    USING (available_until::timestamp AT TIME ZONE 'Europe/Zurich');

ALTER TABLE public.catches
  ADD CONSTRAINT catches_availability_order CHECK (
    available_until IS NULL OR available_from IS NULL OR available_until > available_from
  );

ALTER TABLE public.catches
  ADD CONSTRAINT catches_delivery_cost_non_negative CHECK (delivery_cost >= 0);

ALTER TABLE public.catches
  ADD CONSTRAINT catches_quantity_positive_when_ready CHECK (
    status IN ('draft','cancelled') OR purchase_quantity > 0
  );

-- 3. Catch-Nummer: fortlaufend pro Jahr, nebenläufigkeitssicher -----------
CREATE TABLE IF NOT EXISTS public.catch_number_sequences (
  year INTEGER PRIMARY KEY,
  last_value INTEGER NOT NULL DEFAULT 0
);
GRANT ALL ON public.catch_number_sequences TO service_role;
ALTER TABLE public.catch_number_sequences ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.next_catch_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Zurich'))::INTEGER;
  v_next INTEGER;
BEGIN
  INSERT INTO public.catch_number_sequences AS s (year, last_value)
  VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_value = s.last_value + 1
  RETURNING last_value INTO v_next;

  RETURN 'KC-' || v_year::TEXT || '-' || lpad(v_next::TEXT, 3, '0');
END;
$$;

ALTER TABLE public.catches ALTER COLUMN catch_number SET DEFAULT public.next_catch_number();

-- Catch-Nummer ist nicht editierbar
CREATE OR REPLACE FUNCTION public.protect_catch_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.catch_number IS DISTINCT FROM OLD.catch_number THEN
    RAISE EXCEPTION 'Die Catch-Nummer kann nicht geändert werden.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_catch_number_update ON public.catches;
CREATE TRIGGER protect_catch_number_update
  BEFORE UPDATE ON public.catches
  FOR EACH ROW EXECUTE FUNCTION public.protect_catch_number();

-- 4. Storage-Richtlinien für den privaten Bildordner ----------------------
DROP POLICY IF EXISTS "Authenticated can read catch images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload catch images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update catch images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete catch images" ON storage.objects;

CREATE POLICY "Authenticated can read catch images" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'catch-images');
CREATE POLICY "Authenticated can upload catch images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'catch-images');
CREATE POLICY "Authenticated can update catch images" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'catch-images') WITH CHECK (bucket_id = 'catch-images');
CREATE POLICY "Authenticated can delete catch images" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'catch-images');

-- 5. Grunddaten ------------------------------------------------------------
INSERT INTO public.suppliers (name) VALUES
  ('Bayshore SA'), ('Kundelfingerhof'), ('Anderer Lieferant')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.locations (name) VALUES
  ('Hofladen Kundelfingerhof'), ('Stadtladen Schaffhausen')
ON CONFLICT (name) DO NOTHING;