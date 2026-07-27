-- 2026-07-27 - Renovación: checklist de la circular (4 PDFs legacy).
-- Solicitud nueva conserva acta/CURP/etc.

ALTER TABLE public.becas_documento
  DROP CONSTRAINT IF EXISTS becas_documento_tipo_check;

ALTER TABLE public.becas_documento
  ADD CONSTRAINT becas_documento_tipo_check
  CHECK (tipo IN (
    'ingresos',
    'domicilio',
    'boleta',
    'comp_inscripcion',
    'acta_nacimiento',
    'curp',
    'curp_tutor',
    'constancia_no_adeudo',
    'carta_buena_conducta',
    'boleta_interna'
  ));

ALTER TABLE public.becas_solicitud_documento
  DROP CONSTRAINT IF EXISTS becas_solicitud_documento_tipo_check;

ALTER TABLE public.becas_solicitud_documento
  ADD CONSTRAINT becas_solicitud_documento_tipo_check
  CHECK (tipo IN (
    'ingresos',
    'domicilio',
    'boleta',
    'comp_inscripcion',
    'acta_nacimiento',
    'curp',
    'curp_tutor',
    'constancia_no_adeudo',
    'carta_buena_conducta',
    'boleta_interna'
  ));

-- Flags renovación (circular)
ALTER TABLE public.becas_renovacion
  ADD COLUMN IF NOT EXISTS ingresos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS domicilio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boleta boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comp_inscripcion boolean NOT NULL DEFAULT false;

-- Compat: si quedó el nombre corto del schema original
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'becas_renovacion'
      AND column_name = 'comp_inscrip'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'becas_renovacion'
      AND column_name = 'comp_inscripcion'
  ) THEN
    ALTER TABLE public.becas_renovacion RENAME COLUMN comp_inscrip TO comp_inscripcion;
  END IF;
END $$;

-- Flags solicitud por si algún flujo usa los 4 de renovación
ALTER TABLE public.becas_solicitud
  ADD COLUMN IF NOT EXISTS ingresos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS domicilio boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boleta boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comp_inscripcion boolean NOT NULL DEFAULT false;
