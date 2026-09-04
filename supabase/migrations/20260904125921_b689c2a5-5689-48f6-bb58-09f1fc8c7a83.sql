ALTER TABLE public.catches ALTER COLUMN catch_number DROP DEFAULT;

CREATE OR REPLACE FUNCTION public.assign_catch_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year INTEGER := EXTRACT(YEAR FROM (now() AT TIME ZONE 'Europe/Zurich'))::INTEGER;
  v_next INTEGER;
BEGIN
  IF NEW.catch_number IS NOT NULL AND NEW.catch_number <> '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.catch_number_sequences AS s (year, last_value)
  VALUES (v_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_value = s.last_value + 1
  RETURNING last_value INTO v_next;

  NEW.catch_number := 'KC-' || v_year::TEXT || '-' || lpad(v_next::TEXT, 3, '0');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_catch_number() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.catches ALTER COLUMN catch_number DROP NOT NULL;

DROP TRIGGER IF EXISTS assign_catch_number_insert ON public.catches;
CREATE TRIGGER assign_catch_number_insert
  BEFORE INSERT ON public.catches
  FOR EACH ROW EXECUTE FUNCTION public.assign_catch_number();

DROP FUNCTION IF EXISTS public.next_catch_number();