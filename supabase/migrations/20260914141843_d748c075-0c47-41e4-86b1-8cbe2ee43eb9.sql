ALTER TABLE public.catches
  ADD COLUMN IF NOT EXISTS vat_rate numeric;

UPDATE public.catches SET vat_rate = 0 WHERE vat_rate IS NULL;

ALTER TABLE public.catches
  ADD CONSTRAINT catches_vat_rate_range CHECK (vat_rate IS NULL OR (vat_rate >= 0 AND vat_rate <= 100));

COMMENT ON COLUMN public.catches.vat_rate IS 'Schweizer MWST-Satz in Prozent, mit dem der brutto erfasste Catch-Preis auf netto umgerechnet wird. NULL = globaler Standardsatz aus application_settings.';