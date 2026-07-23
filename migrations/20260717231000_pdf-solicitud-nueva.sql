-- 2026-07-17 - PDF de formulario de solicitud nueva (Storage key/url).
ALTER TABLE public.becas_solicitud
  ADD COLUMN IF NOT EXISTS pdf_solicitud_key text,
  ADD COLUMN IF NOT EXISTS pdf_solicitud_url text;

COMMENT ON COLUMN public.becas_solicitud.pdf_solicitud_key IS
  'Key en bucket becas-documentos del PDF generado al guardar el formulario.';
COMMENT ON COLUMN public.becas_solicitud.pdf_solicitud_url IS
  'URL opcional del PDF de formulario (si el upload la expone).';
