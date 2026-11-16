ALTER TABLE public.catches ADD COLUMN IF NOT EXISTS pricing_basis jsonb;
ALTER TABLE public.catches ADD CONSTRAINT catches_pricing_basis_shape CHECK (pricing_basis IS NULL OR (jsonb_typeof(pricing_basis) = 'object' AND pricing_basis->>'version' = '1'));
COMMENT ON COLUMN public.catches.pricing_basis IS 'Optional separate purchase/sale basis (version 1). Legacy columns stay dimension-consistent: quantity_unit Stk = sale pack, purchase_quantity = full sale packs, purchase_price = purchase total / packs, catch_price/regular_price per sale pack.';
