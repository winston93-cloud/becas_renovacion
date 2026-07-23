-- 2026-07-16 - Agregar alumno_ref (No. Control) a alumno_beca, derivado de alumno vía alumno_id

ALTER TABLE public.alumno_beca
  ADD COLUMN IF NOT EXISTS alumno_ref integer;

-- Rellenar desde el maestro
UPDATE public.alumno_beca ab
SET alumno_ref = a.alumno_ref
FROM public.alumno a
WHERE a.alumno_id = ab.alumno_id
  AND (ab.alumno_ref IS DISTINCT FROM a.alumno_ref);

CREATE INDEX IF NOT EXISTS alumno_beca_alumno_ref_idx
  ON public.alumno_beca (alumno_ref);

-- Mantener alumno_ref sincronizado al insertar/actualizar alumno_beca
CREATE OR REPLACE FUNCTION public.alumno_beca_sync_alumno_ref()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.alumno_id IS NOT NULL THEN
    SELECT a.alumno_ref INTO NEW.alumno_ref
    FROM public.alumno a
    WHERE a.alumno_id = NEW.alumno_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alumno_beca_sync_alumno_ref_trg ON public.alumno_beca;

CREATE TRIGGER alumno_beca_sync_alumno_ref_trg
  BEFORE INSERT OR UPDATE OF alumno_id
  ON public.alumno_beca
  FOR EACH ROW
  EXECUTE FUNCTION public.alumno_beca_sync_alumno_ref();

-- Si cambia alumno_ref en alumno, propagar a sus filas de alumno_beca
CREATE OR REPLACE FUNCTION public.alumno_propagate_ref_to_beca()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.alumno_ref IS DISTINCT FROM OLD.alumno_ref THEN
    UPDATE public.alumno_beca
    SET alumno_ref = NEW.alumno_ref
    WHERE alumno_id = NEW.alumno_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS alumno_propagate_ref_to_beca_trg ON public.alumno;

CREATE TRIGGER alumno_propagate_ref_to_beca_trg
  AFTER UPDATE OF alumno_ref
  ON public.alumno
  FOR EACH ROW
  EXECUTE FUNCTION public.alumno_propagate_ref_to_beca();
