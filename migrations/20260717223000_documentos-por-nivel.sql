-- 2026-07-17 - Catálogo de documentos por trámite/nivel (acta, CURP, etc.).
-- Reemplaza ingresos|domicilio|boleta|comp_inscripcion.

-- Quitar filas con tipos legacy (checklist se recalcula al subir)
DELETE FROM public.becas_documento
WHERE tipo NOT IN (
  'acta_nacimiento', 'curp', 'curp_tutor',
  'constancia_no_adeudo', 'carta_buena_conducta', 'boleta_interna'
);

DELETE FROM public.becas_solicitud_documento
WHERE tipo NOT IN (
  'acta_nacimiento', 'curp', 'curp_tutor',
  'constancia_no_adeudo', 'carta_buena_conducta', 'boleta_interna'
);

ALTER TABLE public.becas_documento
  DROP CONSTRAINT IF EXISTS becas_documento_tipo_check;

ALTER TABLE public.becas_documento
  ADD CONSTRAINT becas_documento_tipo_check
  CHECK (tipo IN (
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
    'acta_nacimiento',
    'curp',
    'curp_tutor',
    'constancia_no_adeudo',
    'carta_buena_conducta',
    'boleta_interna'
  ));

-- Flags renovación: drop legacy + columnas nuevas
ALTER TABLE public.becas_renovacion
  DROP COLUMN IF EXISTS ingresos,
  DROP COLUMN IF EXISTS domicilio,
  DROP COLUMN IF EXISTS boleta,
  DROP COLUMN IF EXISTS comp_inscrip;

ALTER TABLE public.becas_renovacion
  ADD COLUMN IF NOT EXISTS acta_nacimiento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS curp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS curp_tutor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS constancia_no_adeudo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS carta_buena_conducta boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boleta_interna boolean NOT NULL DEFAULT false;

-- Flags solicitud: drop legacy + columnas nuevas
ALTER TABLE public.becas_solicitud
  DROP COLUMN IF EXISTS ingresos,
  DROP COLUMN IF EXISTS domicilio,
  DROP COLUMN IF EXISTS boleta,
  DROP COLUMN IF EXISTS comp_inscripcion;

ALTER TABLE public.becas_solicitud
  ADD COLUMN IF NOT EXISTS acta_nacimiento boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS curp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS curp_tutor boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS constancia_no_adeudo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS carta_buena_conducta boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS boleta_interna boolean NOT NULL DEFAULT false;
