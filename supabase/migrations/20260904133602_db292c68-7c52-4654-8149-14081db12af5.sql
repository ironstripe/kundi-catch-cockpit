ALTER TABLE public.catches
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS published_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_text text,
  ADD COLUMN IF NOT EXISTS published_image_path text,
  ADD COLUMN IF NOT EXISTS post_generated_text text,
  ADD COLUMN IF NOT EXISTS post_final_text text,
  ADD COLUMN IF NOT EXISTS post_generated_at timestamptz,
  ADD COLUMN IF NOT EXISTS post_source_signature text,
  ADD COLUMN IF NOT EXISTS post_outdated_decision text;

ALTER TABLE public.catches DROP CONSTRAINT IF EXISTS catches_post_outdated_decision_check;
ALTER TABLE public.catches ADD CONSTRAINT catches_post_outdated_decision_check
  CHECK (post_outdated_decision IS NULL OR post_outdated_decision IN ('keep', 'regenerate'));

ALTER TABLE public.catch_images
  ADD COLUMN IF NOT EXISTS optimized_path text,
  ADD COLUMN IF NOT EXISTS optimized_source_path text;

ALTER TABLE public.post_versions
  ADD COLUMN IF NOT EXISTS generated_text text,
  ADD COLUMN IF NOT EXISTS final_text text,
  ADD COLUMN IF NOT EXISTS reason text,
  ADD COLUMN IF NOT EXISTS used_for_publication boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS image_path text;

ALTER TABLE public.post_versions ALTER COLUMN body DROP NOT NULL;
ALTER TABLE public.post_versions ALTER COLUMN version SET DEFAULT 1;

CREATE INDEX IF NOT EXISTS post_versions_catch_id_created_at_idx
  ON public.post_versions (catch_id, created_at DESC);
CREATE INDEX IF NOT EXISTS catches_published_at_idx ON public.catches (published_at DESC);