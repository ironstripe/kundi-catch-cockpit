ALTER TABLE public.catches
  ADD COLUMN internal_handling_cost_per_unit numeric(12,4);

ALTER TABLE public.catches
  ADD CONSTRAINT catches_internal_handling_cost_non_negative
  CHECK (internal_handling_cost_per_unit IS NULL OR internal_handling_cost_per_unit >= 0);

CREATE OR REPLACE FUNCTION public.catch_source_signature(_catch_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    coalesce(c.internal_handling_cost_per_unit::text, ''),
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