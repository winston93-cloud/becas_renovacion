-- 2026-07-16 - Política: no almacenar ingresos de padres/madres.
UPDATE public.becas_renovacion
SET
  ingreso_mensual_padre = NULL,
  ingreso_mensual_madre = NULL
WHERE ingreso_mensual_padre IS NOT NULL
   OR ingreso_mensual_madre IS NOT NULL;
