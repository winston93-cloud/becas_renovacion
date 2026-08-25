-- 2026-08-25 - Solicitud nueva: ingresos + boleta SEP; exención maternal/kinder sin boleta.

ALTER TABLE public.becas_solicitud
  ADD COLUMN IF NOT EXISTS sin_boleta_sep boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.becas_solicitud.sin_boleta_sep IS
  'Maternal/Kinder: el padre indica que el alumno no trae boleta SEP (viene de casa). No exime ingresos.';
