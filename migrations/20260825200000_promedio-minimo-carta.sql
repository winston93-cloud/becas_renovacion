-- Promedio mínimo personalizado para carta de aceptación (beca Académica).

ALTER TABLE public.becas_renovacion
  ADD COLUMN IF NOT EXISTS promedio_minimo_carta numeric(4,2);

ALTER TABLE public.becas_solicitud
  ADD COLUMN IF NOT EXISTS promedio_minimo_carta numeric(4,2);

COMMENT ON COLUMN public.becas_renovacion.promedio_minimo_carta IS
  'Override del promedio mínimo en carta de firma electrónica (solo beca Académica; default 9.5).';

COMMENT ON COLUMN public.becas_solicitud.promedio_minimo_carta IS
  'Override del promedio mínimo en carta de firma electrónica (solo beca Académica; default 9.5).';
