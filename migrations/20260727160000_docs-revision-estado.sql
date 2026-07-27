-- Revisión de documentos por Control Escolar (ok / incorrecto / pendiente).
-- La verificación completa del expediente exige todos los docs requeridos en 'ok'.

ALTER TABLE public.becas_documento
  ADD COLUMN IF NOT EXISTS revision_estado text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS revision_nota text,
  ADD COLUMN IF NOT EXISTS revisado_en timestamptz,
  ADD COLUMN IF NOT EXISTS revisado_por text;

ALTER TABLE public.becas_documento
  DROP CONSTRAINT IF EXISTS becas_documento_revision_estado_check;

ALTER TABLE public.becas_documento
  ADD CONSTRAINT becas_documento_revision_estado_check
  CHECK (revision_estado IN ('pendiente', 'ok', 'incorrecto'));

COMMENT ON COLUMN public.becas_documento.revision_estado IS
  'pendiente = subido sin revisar; ok = correcto; incorrecto = rechazado (padre debe resubir).';

ALTER TABLE public.becas_solicitud_documento
  ADD COLUMN IF NOT EXISTS revision_estado text NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS revision_nota text,
  ADD COLUMN IF NOT EXISTS revisado_en timestamptz,
  ADD COLUMN IF NOT EXISTS revisado_por text;

ALTER TABLE public.becas_solicitud_documento
  DROP CONSTRAINT IF EXISTS becas_solicitud_documento_revision_estado_check;

ALTER TABLE public.becas_solicitud_documento
  ADD CONSTRAINT becas_solicitud_documento_revision_estado_check
  CHECK (revision_estado IN ('pendiente', 'ok', 'incorrecto'));

COMMENT ON COLUMN public.becas_solicitud_documento.revision_estado IS
  'pendiente = subido sin revisar; ok = correcto; incorrecto = rechazado (padre debe resubir).';
