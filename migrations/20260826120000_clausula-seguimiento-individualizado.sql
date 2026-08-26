-- Cláusula opcional de seguimiento individualizado en carta de aceptación.

ALTER TABLE public.becas_renovacion
  ADD COLUMN IF NOT EXISTS seguimiento_individualizado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clausula_seguimiento_texto text;

ALTER TABLE public.becas_solicitud
  ADD COLUMN IF NOT EXISTS seguimiento_individualizado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS clausula_seguimiento_texto text;

COMMENT ON COLUMN public.becas_renovacion.seguimiento_individualizado IS
  'Si true, la carta de aceptación incluye cláusula de seguimiento individualizado al final.';

COMMENT ON COLUMN public.becas_renovacion.clausula_seguimiento_texto IS
  'Texto editable de la cláusula de seguimiento (solo aplica si seguimiento_individualizado).';

COMMENT ON COLUMN public.becas_solicitud.seguimiento_individualizado IS
  'Si true, la carta de aceptación incluye cláusula de seguimiento individualizado al final.';

COMMENT ON COLUMN public.becas_solicitud.clausula_seguimiento_texto IS
  'Texto editable de la cláusula de seguimiento (solo aplica si seguimiento_individualizado).';
