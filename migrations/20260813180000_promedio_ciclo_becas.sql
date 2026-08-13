-- 2026-08-13 - Promedios finales por alumno/ciclo para renovación de becas.
-- Fuente: boletas Winston ciclo de datos (ej. 22). No es el grado de ficha actual
-- (ej. ficha 6° Primaria → grado_origen 5).

CREATE TABLE IF NOT EXISTS public.promedio_ciclo (
  alumno_id integer NOT NULL,
  alumno_ref text,
  ciclo integer NOT NULL,
  nivel_origen integer,
  grado_origen integer,
  fuente text NOT NULL CHECK (fuente IN ('kinder', 'primaria', 'secundaria')),
  promedio_es numeric(4,2),
  promedio_en numeric(4,2),
  letra_en text,
  promedio_general numeric(4,2) NOT NULL,
  calculado_en timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (alumno_id, ciclo)
);

CREATE INDEX IF NOT EXISTS promedio_ciclo_ciclo_idx ON public.promedio_ciclo (ciclo);
CREATE INDEX IF NOT EXISTS promedio_ciclo_ref_idx ON public.promedio_ciclo (alumno_ref);

COMMENT ON TABLE public.promedio_ciclo IS
  'Promedio final Winston por alumno y ciclo de boletas (renovación becas). Ciclo 22 = datos previos a ficha actual.';
COMMENT ON COLUMN public.promedio_ciclo.grado_origen IS
  'Grado en que se cursaron las califs (ej. 5 si la ficha ya va en 6).';
