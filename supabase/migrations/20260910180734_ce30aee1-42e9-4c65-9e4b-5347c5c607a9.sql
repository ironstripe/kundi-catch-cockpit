CREATE TABLE public.supplier_offer_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL DEFAULT 'Angebotsdossier',
  supplier_name text,
  status text NOT NULL DEFAULT 'review',
  consolidated_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  consolidation_warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
  extraction_status text NOT NULL DEFAULT 'pending',
  extraction_error text,
  converted_catch_id uuid REFERENCES public.catches(id) ON DELETE SET NULL,
  converted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_offer_cases_status_check
    CHECK (status IN ('review','ready','converted','ignored')),
  CONSTRAINT supplier_offer_cases_extraction_status_check
    CHECK (extraction_status IN ('pending','running','done','failed','skipped'))
);

CREATE UNIQUE INDEX supplier_offer_cases_converted_catch_idx
  ON public.supplier_offer_cases (converted_catch_id)
  WHERE converted_catch_id IS NOT NULL;
CREATE INDEX supplier_offer_cases_status_idx ON public.supplier_offer_cases (status);
CREATE INDEX supplier_offer_cases_updated_at_idx ON public.supplier_offer_cases (updated_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_offer_cases TO authenticated;
GRANT ALL ON public.supplier_offer_cases TO service_role;
ALTER TABLE public.supplier_offer_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active users read offer cases"
  ON public.supplier_offer_cases FOR SELECT TO authenticated
  USING (public.is_active_user());
CREATE POLICY "Editors insert offer cases"
  ON public.supplier_offer_cases FOR INSERT TO authenticated
  WITH CHECK (public.can_edit());
CREATE POLICY "Editors update offer cases"
  ON public.supplier_offer_cases FOR UPDATE TO authenticated
  USING (public.can_edit()) WITH CHECK (public.can_edit());
CREATE POLICY "Admins delete offer cases"
  ON public.supplier_offer_cases FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TRIGGER update_supplier_offer_cases_updated_at
  BEFORE UPDATE ON public.supplier_offer_cases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.supplier_offer_emails
  ADD COLUMN case_id uuid REFERENCES public.supplier_offer_cases(id) ON DELETE SET NULL;
CREATE INDEX supplier_offer_emails_case_idx ON public.supplier_offer_emails (case_id);

ALTER TABLE public.catches
  ADD COLUMN source_case_id uuid REFERENCES public.supplier_offer_cases(id) ON DELETE SET NULL;