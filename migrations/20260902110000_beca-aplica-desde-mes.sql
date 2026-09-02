-- Mes de colegiatura desde el cual aplica la beca (1–12).
-- NULL o 9 = septiembre (flujo normal). Post-cierre / tardíos suelen ser 10 (octubre).
-- Solo identificación operativa; no altera cobros automáticamente.

ALTER TABLE public.becas_renovacion
  ADD COLUMN IF NOT EXISTS beca_aplica_desde_mes smallint;

ALTER TABLE public.becas_solicitud
  ADD COLUMN IF NOT EXISTS beca_aplica_desde_mes smallint;

ALTER TABLE public.becas_renovacion
  DROP CONSTRAINT IF EXISTS becas_renovacion_aplica_desde_mes_chk;
ALTER TABLE public.becas_renovacion
  ADD CONSTRAINT becas_renovacion_aplica_desde_mes_chk
  CHECK (
    beca_aplica_desde_mes IS NULL
    OR (beca_aplica_desde_mes >= 1 AND beca_aplica_desde_mes <= 12)
  );

ALTER TABLE public.becas_solicitud
  DROP CONSTRAINT IF EXISTS becas_solicitud_aplica_desde_mes_chk;
ALTER TABLE public.becas_solicitud
  ADD CONSTRAINT becas_solicitud_aplica_desde_mes_chk
  CHECK (
    beca_aplica_desde_mes IS NULL
    OR (beca_aplica_desde_mes >= 1 AND beca_aplica_desde_mes <= 12)
  );

COMMENT ON COLUMN public.becas_renovacion.beca_aplica_desde_mes IS
  'Mes (1-12) desde el que aplica la beca en colegiaturas. NULL=septiembre/normal.';
COMMENT ON COLUMN public.becas_solicitud.beca_aplica_desde_mes IS
  'Mes (1-12) desde el que aplica la beca en colegiaturas. NULL=septiembre/normal.';
