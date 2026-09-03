-- 2026-09-03 - Beca Winston (id 3) = misma que Grupal (id 11).
-- Se remapean referencias a Grupal y se elimina Winston del catálogo.

UPDATE public.alumno_beca
SET beca_id = 11
WHERE beca_id = 3;

UPDATE public.becas_solicitud
SET beca_deseada_id = 11
WHERE beca_deseada_id = 3;

UPDATE public.becas_alumno_beca
SET beca_id = 11
WHERE beca_id = 3;

-- Espejo legacy: alumno_beca.beca_id → concepto_beca(beca_id)
DELETE FROM public.concepto_beca
WHERE beca_id = 3;

DELETE FROM public.becas_concepto_beca
WHERE beca_id = 3;
