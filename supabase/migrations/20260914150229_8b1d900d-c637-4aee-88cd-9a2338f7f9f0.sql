ALTER TABLE public.catches
  ADD COLUMN IF NOT EXISTS purchase_price_includes_vat BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS purchase_vat_rate NUMERIC DEFAULT 2.6,
  ADD COLUMN IF NOT EXISTS delivery_cost_includes_vat BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS delivery_vat_rate NUMERIC DEFAULT 8.1,
  ADD COLUMN IF NOT EXISTS vat_basis_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.validate_catch_vat_rates()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.purchase_vat_rate IS NOT NULL AND (NEW.purchase_vat_rate < 0 OR NEW.purchase_vat_rate >= 100) THEN
    RAISE EXCEPTION 'Der Mehrwertsteuersatz für den Einkauf muss zwischen 0 und 99.9 Prozent liegen.';
  END IF;
  IF NEW.delivery_vat_rate IS NOT NULL AND (NEW.delivery_vat_rate < 0 OR NEW.delivery_vat_rate >= 100) THEN
    RAISE EXCEPTION 'Der Mehrwertsteuersatz für die Lieferkosten muss zwischen 0 und 99.9 Prozent liegen.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_catch_vat_rates_write ON public.catches;
CREATE TRIGGER validate_catch_vat_rates_write
  BEFORE INSERT OR UPDATE ON public.catches
  FOR EACH ROW EXECUTE FUNCTION public.validate_catch_vat_rates();

COMMENT ON COLUMN public.catches.purchase_price_includes_vat IS 'TRUE = purchase_price ist ein Bruttopreis inkl. MWST. Migrationsannahme fuer Altbestand: FALSE (exkl. MWST).';
COMMENT ON COLUMN public.catches.vat_basis_confirmed IS 'TRUE = die MWST-Basis von Einkauf und Lieferung wurde von einem Menschen bestaetigt.';