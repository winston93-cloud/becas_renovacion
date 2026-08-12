-- Estado 'reenviado': el padre subió de nuevo un documento que estaba incorrecto.

ALTER TABLE public.becas_documento
  DROP CONSTRAINT IF EXISTS becas_documento_revision_estado_check;

ALTER TABLE public.becas_documento
  ADD CONSTRAINT becas_documento_revision_estado_check
  CHECK (revision_estado IN ('pendiente', 'ok', 'incorrecto', 'reenviado'));

COMMENT ON COLUMN public.becas_documento.revision_estado IS
  'pendiente = subido sin revisar; ok = correcto; incorrecto = rechazado; reenviado = padre corrigió y resubió (por revisar de nuevo).';

ALTER TABLE public.becas_solicitud_documento
  DROP CONSTRAINT IF EXISTS becas_solicitud_documento_revision_estado_check;

ALTER TABLE public.becas_solicitud_documento
  ADD CONSTRAINT becas_solicitud_documento_revision_estado_check
  CHECK (revision_estado IN ('pendiente', 'ok', 'incorrecto', 'reenviado'));

COMMENT ON COLUMN public.becas_solicitud_documento.revision_estado IS
  'pendiente = subido sin revisar; ok = correcto; incorrecto = rechazado; reenviado = padre corrigió y resubió (por revisar de nuevo).';
