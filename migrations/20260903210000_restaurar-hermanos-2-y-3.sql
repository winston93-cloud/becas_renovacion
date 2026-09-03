-- 2026-09-03 - Corrección DG/Iriabeth: Hermanos no es Por Familia.
-- Admin distingue Hermanos (2) vs Hermanos (3); papás ven una sola etiqueta «Hermanos».
-- Se deshace el remapeo 13→7 del mismo día (filas tocadas el 2026-09-03).

INSERT INTO public.becas_concepto_beca (
  beca_id,
  beca_clase,
  beca_porcentaje_default,
  beca_promedio_requerido
)
VALUES (13, 'Hermanos (3)', 20, 8.0)
ON CONFLICT (beca_id) DO UPDATE
SET
  beca_clase = EXCLUDED.beca_clase,
  beca_porcentaje_default = EXCLUDED.beca_porcentaje_default,
  beca_promedio_requerido = EXCLUDED.beca_promedio_requerido,
  updated_at = now();

UPDATE public.becas_concepto_beca
SET beca_clase = 'Hermanos (2)',
    updated_at = now()
WHERE beca_id = 10;

INSERT INTO public.concepto_beca (beca_id, beca_clase)
VALUES (13, 'Hermanos (3)')
ON CONFLICT (beca_id) DO UPDATE
SET beca_clase = EXCLUDED.beca_clase;

UPDATE public.concepto_beca
SET beca_clase = 'Hermanos (2)'
WHERE beca_id = 10;

-- Las 49 filas remapeadas hoy (beca_actualizacion = 2026-09-03); las 8 Por Familia reales se conservan.
UPDATE public.alumno_beca
SET beca_id = 13
WHERE beca_id = 7
  AND beca_actualizacion::date = DATE '2026-09-03';

UPDATE public.becas_solicitud
SET beca_deseada_id = 13
WHERE beca_deseada_id = 7;

UPDATE public.becas_alumno_beca
SET beca_id = 13
WHERE beca_id = 7
  AND updated_at::date = DATE '2026-09-03';
