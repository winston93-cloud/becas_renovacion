-- 2026-10-10 - Trámite Beca SEP en InsForge (autorizado por Rubén el 2026-10-10).
-- Una fila por alumno y ciclo; `datos` guarda la solicitud completa (documentos, historial, cálculo,
-- beca sustituida, esperados) tal como la maneja src/lib/sep/repo.ts. Las columnas sueltas son
-- solo para filtrar. Los archivos van al bucket privado `becas-sep-documentos`.
-- No modifica ninguna tabla existente.

CREATE TABLE IF NOT EXISTS public.becas_sep_solicitud (
  id              uuid PRIMARY KEY,
  alumno_id       integer NOT NULL,
  alumno_ref      integer NOT NULL,
  ciclo_escolar   integer NOT NULL,
  alumno_nivel    integer,
  estado          text NOT NULL
                  CHECK (estado IN ('borrador','enviada','correccion','aplicada','rechazada')),
  datos           jsonb NOT NULL,
  creado_en       timestamptz NOT NULL DEFAULT now(),
  actualizado_en  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alumno_id, ciclo_escolar)
);

CREATE INDEX IF NOT EXISTS becas_sep_solicitud_ciclo_estado_idx
  ON public.becas_sep_solicitud (ciclo_escolar, estado, alumno_nivel);

-- Igual que becas_autorizacion_firma: solo la API key de servicio (Route Handlers) la toca.
ALTER TABLE public.becas_sep_solicitud ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.becas_sep_solicitud FROM anon, authenticated;
