-- 2026-07-16 - Re-ligar becas_renovacion.alumno_id al alumno.alumno_id entero (tablas maestro existentes)

-- Vaciar renovaciones de prueba (cascade a hermanos/documentos)
TRUNCATE TABLE public.becas_renovacion CASCADE;

-- Quitar FK uuid hacia becas_alumno
ALTER TABLE public.becas_renovacion
  DROP CONSTRAINT IF EXISTS becas_renovacion_alumno_id_fkey;

-- Cambiar tipo de alumno_id: uuid -> integer
ALTER TABLE public.becas_renovacion
  ALTER COLUMN alumno_id TYPE integer USING 0;

-- Religar al maestro real
ALTER TABLE public.becas_renovacion
  ADD CONSTRAINT becas_renovacion_alumno_id_fkey
  FOREIGN KEY (alumno_id) REFERENCES public.alumno(alumno_id) ON DELETE CASCADE;

-- UNIQUE (alumno_id, ciclo_escolar) ya debería existir; asegurar índice
CREATE UNIQUE INDEX IF NOT EXISTS becas_renovacion_alumno_ciclo_uidx
  ON public.becas_renovacion (alumno_id, ciclo_escolar);
