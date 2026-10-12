-- 2026-10-12 - Respuestas de las familias al cuestionario "Beneficios externos" (servicios escolares).
-- Una fila por alumno y ciclo; la última respuesta reemplaza a la anterior.
-- Solo la escriben/leen los servidores con la API key admin (servicios y portal de becas).
CREATE TABLE IF NOT EXISTS public.beneficios_externos_respuesta (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id integer NOT NULL,
  alumno_ref integer,
  alumno_nivel integer,
  ciclo_escolar integer NOT NULL,
  aplico boolean NOT NULL,
  beneficio text CHECK (beneficio IN ('sep', 'otra')),
  beneficio_nombre text CHECK (char_length(beneficio_nombre) <= 120),
  recibio boolean,
  es_prueba boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alumno_id, ciclo_escolar),
  CHECK (aplico OR (beneficio IS NULL AND recibio IS NULL))
);

CREATE INDEX IF NOT EXISTS beneficios_externos_respuesta_ciclo_idx
  ON public.beneficios_externos_respuesta (ciclo_escolar, alumno_nivel);

ALTER TABLE public.beneficios_externos_respuesta ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.beneficios_externos_respuesta FROM anon, authenticated;
