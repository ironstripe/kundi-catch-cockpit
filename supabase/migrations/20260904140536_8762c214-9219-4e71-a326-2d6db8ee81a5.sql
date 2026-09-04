-- 1. Profile
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

INSERT INTO public.profiles (id, name, email)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'name', split_part(u.email, '@', 1)), u.email
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Hilfsfunktionen
CREATE OR REPLACE FUNCTION public.is_active_user()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.active)
$$;
REVOKE EXECUTE ON FUNCTION public.is_active_user() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.can_edit()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_active_user()
    AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
$$;
REVOKE EXECUTE ON FUNCTION public.can_edit() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.can_edit() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_active_user() AND public.has_role(auth.uid(), 'admin')
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- Profil-Policies
CREATE POLICY "Active users can read profiles" ON public.profiles
FOR SELECT TO authenticated USING (public.is_active_user() OR id = auth.uid());
CREATE POLICY "Users can update own name" ON public.profiles
FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Admins can manage profiles" ON public.profiles
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 3. Produktkategorien
CREATE TABLE IF NOT EXISTS public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS product_categories_name_key
  ON public.product_categories (lower(btrim(name)));
GRANT SELECT ON public.product_categories TO authenticated;
GRANT INSERT, UPDATE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active users can read categories" ON public.product_categories
FOR SELECT TO authenticated USING (public.is_active_user());
CREATE POLICY "Admins can manage categories" ON public.product_categories
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER update_product_categories_updated_at BEFORE UPDATE ON public.product_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.product_categories (name, sort_order) VALUES
  ('Fisch ganz', 1), ('Filet', 2), ('Rauchfisch', 3),
  ('Krustentiere', 4), ('Muscheln', 5), ('Weitere Seafood-Produkte', 6)
ON CONFLICT DO NOTHING;

ALTER TABLE public.catches ADD COLUMN IF NOT EXISTS category_id UUID
  REFERENCES public.product_categories(id) ON DELETE SET NULL;

-- 4. Anwendungseinstellungen
CREATE TABLE IF NOT EXISTS public.application_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.application_settings TO authenticated;
GRANT ALL ON public.application_settings TO service_role;
ALTER TABLE public.application_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Active users can read settings" ON public.application_settings
FOR SELECT TO authenticated USING (public.is_active_user());
CREATE POLICY "Admins can manage settings" ON public.application_settings
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE TRIGGER update_application_settings_updated_at BEFORE UPDATE ON public.application_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.application_settings (key, value) VALUES
  ('calculation_thresholds', '{"minimum_green_margin":15,"minimum_green_discount":25,"maximum_green_break_even":85,"maximum_orange_break_even":95}'::jsonb),
  ('whatsapp_template', '{"detail_order":["description","packaging"],"show_expiry":true,"show_available_until":true,"show_discount":true,"pickup_label":"📍 Abholung:","available_from_label":"📅 Ab:"}'::jsonb),
  ('brand_logo', '{"path":null,"file_name":null,"mime_type":null,"size":null}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 5. Audit erweitern
ALTER TABLE public.audit_events ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.audit_events DROP CONSTRAINT IF EXISTS audit_events_action_valid;
ALTER TABLE public.audit_events ADD CONSTRAINT audit_events_action_valid CHECK (action = ANY (ARRAY[
  'created','updated','status_changed','published','deleted',
  'closed','reconciliation_changed','reopened','cancelled',
  'calculation_decision','critical_calculation_confirmed',
  'user_created','user_updated','role_changed','user_activated','user_deactivated',
  'password_reset_sent','supplier_created','supplier_updated',
  'location_created','location_updated','category_created','category_updated',
  'thresholds_updated','template_updated','logo_replaced','settings_reset'
]));
CREATE INDEX IF NOT EXISTS audit_events_created_at_idx ON public.audit_events (created_at DESC);

DROP POLICY IF EXISTS "Authenticated users can read audit events" ON public.audit_events;
DROP POLICY IF EXISTS "Authenticated users can create audit events" ON public.audit_events;
CREATE POLICY "Admins can read audit events" ON public.audit_events
FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Active users can create audit events" ON public.audit_events
FOR INSERT TO authenticated WITH CHECK (public.is_active_user());

-- 6. Rollenbasierte Policies für die operativen Tabellen
DROP POLICY IF EXISTS "Authenticated users can read catches" ON public.catches;
DROP POLICY IF EXISTS "Authenticated users can write catches" ON public.catches;
CREATE POLICY "Active users can read catches" ON public.catches
FOR SELECT TO authenticated USING (public.is_active_user());
CREATE POLICY "Editors can write catches" ON public.catches
FOR ALL TO authenticated USING (public.can_edit()) WITH CHECK (public.can_edit());

DROP POLICY IF EXISTS "Authenticated users can read catch images" ON public.catch_images;
DROP POLICY IF EXISTS "Authenticated users can write catch images" ON public.catch_images;
CREATE POLICY "Active users can read catch images" ON public.catch_images
FOR SELECT TO authenticated USING (public.is_active_user());
CREATE POLICY "Editors can write catch images" ON public.catch_images
FOR ALL TO authenticated USING (public.can_edit()) WITH CHECK (public.can_edit());

DROP POLICY IF EXISTS "Authenticated users can read catch locations" ON public.catch_locations;
DROP POLICY IF EXISTS "Authenticated users can write catch locations" ON public.catch_locations;
CREATE POLICY "Active users can read catch locations" ON public.catch_locations
FOR SELECT TO authenticated USING (public.is_active_user());
CREATE POLICY "Editors can write catch locations" ON public.catch_locations
FOR ALL TO authenticated USING (public.can_edit()) WITH CHECK (public.can_edit());

DROP POLICY IF EXISTS "Authenticated users can read post versions" ON public.post_versions;
DROP POLICY IF EXISTS "Authenticated users can write post versions" ON public.post_versions;
CREATE POLICY "Active users can read post versions" ON public.post_versions
FOR SELECT TO authenticated USING (public.is_active_user());
CREATE POLICY "Editors can write post versions" ON public.post_versions
FOR ALL TO authenticated USING (public.can_edit()) WITH CHECK (public.can_edit());

DROP POLICY IF EXISTS "Authenticated users can read suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can write suppliers" ON public.suppliers;
CREATE POLICY "Active users can read suppliers" ON public.suppliers
FOR SELECT TO authenticated USING (public.is_active_user());
CREATE POLICY "Admins can manage suppliers" ON public.suppliers
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Authenticated users can read locations" ON public.locations;
DROP POLICY IF EXISTS "Authenticated users can write locations" ON public.locations;
CREATE POLICY "Active users can read locations" ON public.locations
FOR SELECT TO authenticated USING (public.is_active_user());
CREATE POLICY "Admins can manage locations" ON public.locations
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE UNIQUE INDEX IF NOT EXISTS suppliers_name_key ON public.suppliers (lower(btrim(name)));
CREATE UNIQUE INDEX IF NOT EXISTS locations_name_key ON public.locations (lower(btrim(name)));

-- 7. Rollen dürfen nur Admins vergeben
DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.user_roles;
DROP POLICY IF EXISTS "Active users can read roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Active users can read roles" ON public.user_roles
FOR SELECT TO authenticated USING (public.is_active_user() OR user_id = auth.uid());
CREATE POLICY "Admins can manage roles" ON public.user_roles
FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
GRANT INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;