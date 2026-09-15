UPDATE public.locations
SET name = 'Stadtladen Schaffhausen',
    address = 'Kirchhofplatz 10, 8200 Schaffhausen',
    pickup_note = CASE WHEN coalesce(btrim(pickup_note), '') = '' THEN pickup_note ELSE pickup_note END
WHERE lower(regexp_replace(name, '\s+', ' ', 'g')) IN ('stadtladen schaffhausen', 'hofladen schaffhausen');

ALTER TABLE public.catches ADD COLUMN IF NOT EXISTS online_shop_url text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'catches_online_shop_url_safe'
  ) THEN
    ALTER TABLE public.catches
      ADD CONSTRAINT catches_online_shop_url_safe CHECK (
        online_shop_url IS NULL
        OR (
          online_shop_url = btrim(online_shop_url)
          AND online_shop_url <> ''
          AND online_shop_url !~ '\s'
          AND (
            online_shop_url ~* '^https://[^/\s]+'
            OR online_shop_url ~* '^http://localhost(:[0-9]+)?(/|$)'
          )
        )
      );
  END IF;
END $$;