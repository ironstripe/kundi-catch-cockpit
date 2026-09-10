ALTER TABLE public.supplier_offer_attachments
  ADD COLUMN IF NOT EXISTS content_extraction_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS extracted_text TEXT,
  ADD COLUMN IF NOT EXISTS extraction_error TEXT,
  ADD COLUMN IF NOT EXISTS extracted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS extraction_meta JSONB;

ALTER TABLE public.supplier_offer_attachments
  DROP CONSTRAINT IF EXISTS supplier_offer_attachments_content_extraction_status_check;

ALTER TABLE public.supplier_offer_attachments
  ADD CONSTRAINT supplier_offer_attachments_content_extraction_status_check
  CHECK (content_extraction_status IN ('pending','processing','done','unsupported','failed'));