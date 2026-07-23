-- 2026-07-17 - Solicitud de beca (nuevo ingreso): flag de permiso en alumno,
-- catálogo Deportiva (Ajedrez), tablas becas_solicitud / hermano / documento.
-- Sustituye los 63 códigos hardcodeados del legacy (acceso.php / Index2.php).

-- Flag de autorización para ingresar al portal de nueva solicitud
ALTER TABLE public.alumno
  ADD COLUMN IF NOT EXISTS alumno_permiso_solicitud_beca smallint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.alumno.alumno_permiso_solicitud_beca IS
  '1 = autorizado a solicitar beca por primera vez; 0 = sin permiso. Reemplaza códigos de acceso hardcodeados del legacy.';

CREATE INDEX IF NOT EXISTS alumno_permiso_solicitud_beca_idx
  ON public.alumno (alumno_permiso_solicitud_beca)
  WHERE alumno_permiso_solicitud_beca = 1;

-- Tipo de beca presente en Index2.php y ausente en el catálogo migrado
INSERT INTO public.becas_concepto_beca (beca_id, beca_clase, beca_porcentaje_default, beca_promedio_requerido)
VALUES (18, 'Deportiva (Ajedrez)', 0, 0.0)
ON CONFLICT (beca_id) DO NOTHING;

-- Solicitud unificada (una fila por alumno/ciclo calendario)
CREATE TABLE IF NOT EXISTS public.becas_solicitud (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id integer NOT NULL REFERENCES public.alumno(alumno_id) ON DELETE CASCADE,
  ciclo_escolar integer NOT NULL,
  beca_deseada_id smallint REFERENCES public.becas_concepto_beca(beca_id),
  beca_porcentaje_deseado numeric(5,2),
  tiene_otra_beca boolean NOT NULL DEFAULT false,
  otra_beca_sep boolean NOT NULL DEFAULT false,
  otra_beca_pemex boolean NOT NULL DEFAULT false,
  otra_beca_empresarial boolean NOT NULL DEFAULT false,
  otra_beca_otro boolean NOT NULL DEFAULT false,
  aporta_gastos boolean,
  parentesco_aportante text,
  vivienda_tipo text,
  motivo text,
  ingresos boolean NOT NULL DEFAULT false,
  domicilio boolean NOT NULL DEFAULT false,
  boleta boolean NOT NULL DEFAULT false,
  comp_inscripcion boolean NOT NULL DEFAULT false,
  enviado boolean NOT NULL DEFAULT false,
  enviado_en timestamptz,
  beca_autorizada boolean NOT NULL DEFAULT false,
  verificado boolean NOT NULL DEFAULT false,
  fecha_verificado timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alumno_id, ciclo_escolar)
);

CREATE INDEX IF NOT EXISTS becas_solicitud_ciclo_idx
  ON public.becas_solicitud (ciclo_escolar);

CREATE INDEX IF NOT EXISTS becas_solicitud_enviado_idx
  ON public.becas_solicitud (enviado);

-- Hermanos capturados en el formulario (legacy n1-4 / e1-4 / ei1-4 / c1-4)
CREATE TABLE IF NOT EXISTS public.becas_solicitud_hermano (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id uuid NOT NULL REFERENCES public.becas_solicitud(id) ON DELETE CASCADE,
  orden smallint NOT NULL CHECK (orden BETWEEN 1 AND 4),
  nombre text,
  edad smallint,
  institucion text,
  colegiatura_mensual numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (solicitud_id, orden)
);

CREATE INDEX IF NOT EXISTS becas_solicitud_hermano_solicitud_idx
  ON public.becas_solicitud_hermano (solicitud_id);

-- Documentos PDF en Storage (mismos 4 tipos que envio2.php)
CREATE TABLE IF NOT EXISTS public.becas_solicitud_documento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id uuid NOT NULL REFERENCES public.becas_solicitud(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('ingresos', 'domicilio', 'boleta', 'comp_inscripcion')),
  storage_bucket text NOT NULL DEFAULT 'becas-documentos',
  storage_key text NOT NULL,
  storage_url text,
  nombre_original text,
  subido_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (solicitud_id, tipo)
);

CREATE INDEX IF NOT EXISTS becas_solicitud_documento_solicitud_idx
  ON public.becas_solicitud_documento (solicitud_id);

-- Triggers updated_at
CREATE TRIGGER becas_solicitud_updated_at
  BEFORE UPDATE ON public.becas_solicitud
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER becas_solicitud_hermano_updated_at
  BEFORE UPDATE ON public.becas_solicitud_hermano
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

-- Acceso solo vía Route Handlers con API key de servicio (no SDK público)
REVOKE ALL ON TABLE public.becas_solicitud FROM anon, authenticated;
REVOKE ALL ON TABLE public.becas_solicitud_hermano FROM anon, authenticated;
REVOKE ALL ON TABLE public.becas_solicitud_documento FROM anon, authenticated;
