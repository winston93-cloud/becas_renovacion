-- 2026-07-17 - Flag: el alumno ya pidió acceso al trámite de solicitud nueva.
-- Coordinación activa alumno_permiso_solicitud_beca=1 para abrir el formulario.

ALTER TABLE public.alumno
  ADD COLUMN IF NOT EXISTS alumno_solicitud_acceso_enviada smallint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alumno_solicitud_acceso_en timestamptz;

COMMENT ON COLUMN public.alumno.alumno_solicitud_acceso_enviada IS
  '1 = ya envió solicitud de acceso a coordinación de becas; 0 = aún no. Distinto de alumno_permiso_solicitud_beca.';

COMMENT ON COLUMN public.alumno.alumno_solicitud_acceso_en IS
  'Fecha/hora en que se envió el correo de solicitud de acceso.';

CREATE INDEX IF NOT EXISTS alumno_solicitud_acceso_enviada_idx
  ON public.alumno (alumno_solicitud_acceso_enviada)
  WHERE alumno_solicitud_acceso_enviada = 1;
