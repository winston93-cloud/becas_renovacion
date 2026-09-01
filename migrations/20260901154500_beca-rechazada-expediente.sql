-- Marca explícita de beca rechazada (correo enviado a la familia).
ALTER TABLE public.becas_renovacion
  ADD COLUMN IF NOT EXISTS beca_rechazada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS beca_rechazada_en timestamptz;

ALTER TABLE public.becas_solicitud
  ADD COLUMN IF NOT EXISTS beca_rechazada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS beca_rechazada_en timestamptz;

CREATE INDEX IF NOT EXISTS becas_renovacion_rechazada_idx
  ON public.becas_renovacion (ciclo_escolar, beca_rechazada)
  WHERE beca_rechazada = true;

CREATE INDEX IF NOT EXISTS becas_solicitud_rechazada_idx
  ON public.becas_solicitud (ciclo_escolar, beca_rechazada)
  WHERE beca_rechazada = true;

COMMENT ON COLUMN public.becas_renovacion.beca_rechazada IS
  'True cuando Dirección envió correo de rechazo de beca a la familia.';
COMMENT ON COLUMN public.becas_solicitud.beca_rechazada IS
  'True cuando Dirección envió correo de rechazo de beca a la familia.';

-- Backfill desde bitácora (correos de rechazo ya enviados).
UPDATE public.becas_renovacion r
SET
  beca_rechazada = true,
  beca_rechazada_en = COALESCE(r.beca_rechazada_en, a.created_at)
FROM public.becas_admin_auditoria a
WHERE a.accion = 'renovacion.rechazo_beca'
  AND a.entidad_id = r.id::text;

UPDATE public.becas_solicitud s
SET
  beca_rechazada = true,
  beca_rechazada_en = COALESCE(s.beca_rechazada_en, a.created_at)
FROM public.becas_admin_auditoria a
WHERE a.accion = 'solicitud.rechazo_beca'
  AND a.entidad_id = s.id::text;
