-- 2026-09-03 - Alinear nombres del catálogo al PDF «Catálogo de Becas».
-- Deportiva (Ajedrez) → Deportiva
-- Por 2 Hermanos → Hermanos
-- Por 3 Hermanos (id 13) se elimina: mismo caso que Familiar/Por Familia (id 7).

UPDATE public.becas_concepto_beca
SET beca_clase = 'Deportiva'
WHERE beca_id = 18;

UPDATE public.becas_concepto_beca
SET beca_clase = 'Hermanos'
WHERE beca_id = 10;

UPDATE public.alumno_beca
SET beca_id = 7
WHERE beca_id = 13;

UPDATE public.becas_solicitud
SET beca_deseada_id = 7
WHERE beca_deseada_id = 13;

UPDATE public.becas_alumno_beca
SET beca_id = 7
WHERE beca_id = 13;

-- Espejo legacy concepto_beca
UPDATE public.concepto_beca
SET beca_clase = 'Deportiva'
WHERE beca_id = 18;

UPDATE public.concepto_beca
SET beca_clase = 'Hermanos'
WHERE beca_id = 10;

DELETE FROM public.concepto_beca
WHERE beca_id = 13;

DELETE FROM public.becas_concepto_beca
WHERE beca_id = 13;
