-- Shared updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Locations -----------------------------------------------------------------
CREATE TABLE public.locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  address TEXT,
  pickup_note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locations TO authenticated;
GRANT ALL ON public.locations TO service_role;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read locations" ON public.locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can write locations" ON public.locations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON public.locations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Suppliers -----------------------------------------------------------------
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  contact_note TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can write suppliers" ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Catches -------------------------------------------------------------------
CREATE TABLE public.catches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  catch_number TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  category TEXT,
  description TEXT,
  temperature TEXT NOT NULL DEFAULT 'fresh',
  status TEXT NOT NULL DEFAULT 'draft',
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  available_from DATE,
  available_until DATE,
  purchase_quantity NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantity_unit TEXT NOT NULL DEFAULT 'kg',
  purchase_price NUMERIC(12,2),
  regular_price NUMERIC(12,2),
  catch_price NUMERIC(12,2),
  expected_sell_through NUMERIC(5,2),
  actual_sell_through NUMERIC(5,2),
  handicap_story TEXT,
  internal_note TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT catches_status_valid CHECK (status IN ('draft','ready','published','closed','cancelled')),
  CONSTRAINT catches_temperature_valid CHECK (temperature IN ('fresh','frozen')),
  CONSTRAINT catches_unit_valid CHECK (quantity_unit IN ('kg','Stk','Portion')),
  CONSTRAINT catches_quantity_non_negative CHECK (purchase_quantity >= 0),
  CONSTRAINT catches_prices_non_negative CHECK (
    (purchase_price IS NULL OR purchase_price >= 0)
    AND (regular_price IS NULL OR regular_price >= 0)
    AND (catch_price IS NULL OR catch_price >= 0)
  ),
  CONSTRAINT catches_sell_through_range CHECK (
    (expected_sell_through IS NULL OR (expected_sell_through >= 0 AND expected_sell_through <= 100))
    AND (actual_sell_through IS NULL OR (actual_sell_through >= 0 AND actual_sell_through <= 100))
  ),
  CONSTRAINT catches_availability_order CHECK (
    available_until IS NULL OR available_from IS NULL OR available_until >= available_from
  )
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catches TO authenticated;
GRANT ALL ON public.catches TO service_role;
ALTER TABLE public.catches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read catches" ON public.catches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can write catches" ON public.catches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_catches_updated_at BEFORE UPDATE ON public.catches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_catches_status ON public.catches (status);
CREATE INDEX idx_catches_available_from ON public.catches (available_from DESC);
CREATE INDEX idx_catches_supplier_id ON public.catches (supplier_id);

-- Catch images ---------------------------------------------------------------
CREATE TABLE public.catch_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  catch_id UUID NOT NULL REFERENCES public.catches(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT catch_images_sort_order_non_negative CHECK (sort_order >= 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catch_images TO authenticated;
GRANT ALL ON public.catch_images TO service_role;
ALTER TABLE public.catch_images ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read catch images" ON public.catch_images FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can write catch images" ON public.catch_images FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_catch_images_updated_at BEFORE UPDATE ON public.catch_images FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_catch_images_catch_id ON public.catch_images (catch_id);
CREATE UNIQUE INDEX idx_catch_images_one_primary ON public.catch_images (catch_id) WHERE is_primary;

-- Catch locations -------------------------------------------------------------
CREATE TABLE public.catch_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  catch_id UUID NOT NULL REFERENCES public.catches(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE RESTRICT,
  allocated_quantity NUMERIC(12,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT catch_locations_unique UNIQUE (catch_id, location_id),
  CONSTRAINT catch_locations_quantity_non_negative CHECK (allocated_quantity IS NULL OR allocated_quantity >= 0)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catch_locations TO authenticated;
GRANT ALL ON public.catch_locations TO service_role;
ALTER TABLE public.catch_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read catch locations" ON public.catch_locations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can write catch locations" ON public.catch_locations FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_catch_locations_location_id ON public.catch_locations (location_id);

-- Post versions ----------------------------------------------------------------
CREATE TABLE public.post_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  catch_id UUID NOT NULL REFERENCES public.catches(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  body TEXT NOT NULL,
  published_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT post_versions_version_positive CHECK (version >= 1),
  CONSTRAINT post_versions_unique UNIQUE (catch_id, version)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.post_versions TO authenticated;
GRANT ALL ON public.post_versions TO service_role;
ALTER TABLE public.post_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read post versions" ON public.post_versions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can write post versions" ON public.post_versions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_post_versions_updated_at BEFORE UPDATE ON public.post_versions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX idx_post_versions_catch_id ON public.post_versions (catch_id);

-- Audit events ------------------------------------------------------------------
CREATE TABLE public.audit_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  payload JSONB,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT audit_events_action_valid CHECK (action IN ('created','updated','status_changed','published','deleted'))
);
GRANT SELECT, INSERT ON public.audit_events TO authenticated;
GRANT ALL ON public.audit_events TO service_role;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can read audit events" ON public.audit_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create audit events" ON public.audit_events FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX idx_audit_events_entity ON public.audit_events (entity_type, entity_id);
CREATE INDEX idx_audit_events_created_at ON public.audit_events (created_at DESC);