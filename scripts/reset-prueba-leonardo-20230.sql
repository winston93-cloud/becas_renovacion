-- Reinicia prueba de autorización/firma: HERNANDEZ OSTOS LEONARDO (control 20230, alumno_id 785).
-- Mantiene verificación de expediente; quita autorización y firma del ciclo 23.

UPDATE public.becas_renovacion
SET beca_autorizada = false,
    updated_at = NOW()
WHERE id = 'a2a67f2c-a641-497e-9e84-f08cdafd9811';

DELETE FROM public.becas_autorizacion_firma
WHERE alumno_id = 785
  AND ciclo_escolar = 23;
