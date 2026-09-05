CREATE TABLE public.supplier_offer_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resend_email_id text NOT NULL UNIQUE,
  message_id text,
  status text NOT NULL DEFAULT 'new',
  forwarded_by_email text,
  forwarded_by_name text,
  original_sender_email text,
  original_sender_name text,
  to_address text,
  subject text,
  text_body text,
  html_body text,
  raw_source text,
  received_at timestamptz NOT NULL DEFAULT now(),
  extraction_status text NOT NULL DEFAULT 'pending',
  extracted_data jsonb,
  extraction_warnings jsonb,
  extraction_error text,
  converted_catch_id uuid REFERENCES public.catches(id) ON DELETE SET NULL,
  converted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_offer_emails_status_check
    CHECK (status IN ('new','extracting','review','converted','ignored','failed')),
  CONSTRAINT supplier_offer_emails_extraction_status_check
    CHECK (extraction_status IN ('pending','running','done','failed','skipped'))
);

CREATE UNIQUE INDEX supplier_offer_emails_converted_catch_idx
  ON public.supplier_offer_emails (converted_catch_id)
  WHERE converted_catch_id IS NOT NULL;
CREATE INDEX supplier_offer_emails_received_at_idx
  ON public.supplier_offer_emails (received_at DESC);
CREATE INDEX supplier_offer_emails_status_idx ON public.supplier_offer_emails (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_offer_emails TO authenticated;
GRANT ALL ON public.supplier_offer_emails TO service_role;
ALTER TABLE public.supplier_offer_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active users read supplier offers"
  ON public.supplier_offer_emails FOR SELECT TO authenticated
  USING (public.is_active_user());
CREATE POLICY "Editors update supplier offers"
  ON public.supplier_offer_emails FOR UPDATE TO authenticated
  USING (public.can_edit()) WITH CHECK (public.can_edit());
CREATE POLICY "Admins delete supplier offers"
  ON public.supplier_offer_emails FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TRIGGER update_supplier_offer_emails_updated_at
  BEFORE UPDATE ON public.supplier_offer_emails
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.supplier_offer_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid NOT NULL REFERENCES public.supplier_offer_emails(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL DEFAULT 'application/octet-stream',
  file_size bigint NOT NULL DEFAULT 0,
  kind text NOT NULL DEFAULT 'other',
  is_primary_image boolean NOT NULL DEFAULT false,
  source_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT supplier_offer_attachments_kind_check
    CHECK (kind IN ('product_image','product_label','specification','price_list','other'))
);

CREATE INDEX supplier_offer_attachments_offer_idx
  ON public.supplier_offer_attachments (offer_id);
CREATE UNIQUE INDEX supplier_offer_attachments_primary_idx
  ON public.supplier_offer_attachments (offer_id)
  WHERE is_primary_image;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_offer_attachments TO authenticated;
GRANT ALL ON public.supplier_offer_attachments TO service_role;
ALTER TABLE public.supplier_offer_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Active users read supplier offer attachments"
  ON public.supplier_offer_attachments FOR SELECT TO authenticated
  USING (public.is_active_user());
CREATE POLICY "Editors update supplier offer attachments"
  ON public.supplier_offer_attachments FOR UPDATE TO authenticated
  USING (public.can_edit()) WITH CHECK (public.can_edit());
CREATE POLICY "Admins delete supplier offer attachments"
  ON public.supplier_offer_attachments FOR DELETE TO authenticated
  USING (public.is_admin());

CREATE TRIGGER update_supplier_offer_attachments_updated_at
  BEFORE UPDATE ON public.supplier_offer_attachments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.inbound_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  received_at timestamptz NOT NULL DEFAULT now(),
  resend_email_id text,
  recipients text,
  from_address text,
  subject text,
  outcome text NOT NULL,
  detail text,
  offer_id uuid REFERENCES public.supplier_offer_emails(id) ON DELETE SET NULL
);

CREATE INDEX inbound_email_log_received_at_idx ON public.inbound_email_log (received_at DESC);

GRANT SELECT ON public.inbound_email_log TO authenticated;
GRANT ALL ON public.inbound_email_log TO service_role;
ALTER TABLE public.inbound_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read inbound email log"
  ON public.inbound_email_log FOR SELECT TO authenticated
  USING (public.is_admin());

ALTER TABLE public.catches
  ADD COLUMN IF NOT EXISTS source_offer_id uuid
  REFERENCES public.supplier_offer_emails(id) ON DELETE SET NULL;