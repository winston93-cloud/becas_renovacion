-- 2026-07-16 - Referencias al PDF de solicitud generado al finalizar.
ALTER TABLE public.becas_renovacion
  ADD COLUMN IF NOT EXISTS pdf_solicitud_key text,
  ADD COLUMN IF NOT EXISTS pdf_solicitud_url text;
