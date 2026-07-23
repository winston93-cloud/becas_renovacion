-- 2026-07-16 - Esquema de renovación de becas (prefijo becas_ en public)
-- Unifica becasr + obs_becas y persiste hermanos/documentos que el PHP no guardaba.

-- Catálogo de tipos de beca
CREATE TABLE public.becas_concepto_beca (
  beca_id smallint PRIMARY KEY,
  beca_clase text NOT NULL,
  beca_porcentaje_default numeric(5,2) NOT NULL DEFAULT 0,
  beca_promedio_requerido numeric(4,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Alumno (identidad escolar)
CREATE TABLE public.becas_alumno (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_ref text NOT NULL UNIQUE,
  alumno_app text NOT NULL DEFAULT '',
  alumno_apm text NOT NULL DEFAULT '',
  alumno_nombre text NOT NULL DEFAULT '',
  alumno_nivel integer,
  alumno_grado integer,
  alumno_grupo text,
  alumno_ciclo_escolar integer,
  alumno_status integer NOT NULL DEFAULT 1,
  legacy_alumno_id bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX becas_alumno_ciclo_idx ON public.becas_alumno (alumno_ciclo_escolar);
CREATE INDEX becas_alumno_nivel_grado_idx ON public.becas_alumno (alumno_nivel, alumno_grado);

-- Detalle del alumno (domicilio / clave)
CREATE TABLE public.becas_alumno_detalle (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id uuid NOT NULL UNIQUE REFERENCES public.becas_alumno(id) ON DELETE CASCADE,
  alumno_clave text,
  alumno_calle text,
  alumno_numero text,
  alumno_colonia text,
  alumno_cp text,
  alumno_curp text,
  alumno_fecha_nac date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Familiares (madre tutor_id=1, padre tutor_id=2)
CREATE TABLE public.becas_familiar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id uuid NOT NULL REFERENCES public.becas_alumno(id) ON DELETE CASCADE,
  tutor_id smallint NOT NULL CHECK (tutor_id IN (1, 2)),
  familiar_app text NOT NULL DEFAULT '',
  familiar_apm text NOT NULL DEFAULT '',
  familiar_nombre text NOT NULL DEFAULT '',
  familiar_vive boolean,
  familiar_escolaridad text,
  familiar_empresa_nombre text,
  familiar_empresa_puesto text,
  familiar_tel text,
  familiar_cel text,
  familiar_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alumno_id, tutor_id)
);

CREATE INDEX becas_familiar_alumno_idx ON public.becas_familiar (alumno_id);

-- Beca asignada por ciclo escolar
CREATE TABLE public.becas_alumno_beca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id uuid NOT NULL REFERENCES public.becas_alumno(id) ON DELETE CASCADE,
  beca_id smallint NOT NULL REFERENCES public.becas_concepto_beca(beca_id),
  beca_porcentaje numeric(5,2) NOT NULL DEFAULT 0,
  beca_estatus smallint NOT NULL DEFAULT 1,
  beca_ciclo_escolar integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alumno_id, beca_ciclo_escolar)
);

CREATE INDEX becas_alumno_beca_ciclo_estatus_idx
  ON public.becas_alumno_beca (beca_ciclo_escolar, beca_estatus);

-- Renovación unificada (una fila por alumno/ciclo)
CREATE TABLE public.becas_renovacion (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id uuid NOT NULL REFERENCES public.becas_alumno(id) ON DELETE CASCADE,
  ciclo_escolar integer NOT NULL,
  ingreso_mensual_padre numeric(12,2),
  ingreso_mensual_madre numeric(12,2),
  motivo text,
  casa_tipo text,
  otra_beca boolean NOT NULL DEFAULT false,
  otra_beca_porcentaje numeric(5,2),
  observaciones text,
  solicitud boolean NOT NULL DEFAULT false,
  ingresos boolean NOT NULL DEFAULT false,
  domicilio boolean NOT NULL DEFAULT false,
  boleta boolean NOT NULL DEFAULT false,
  comp_inscrip boolean NOT NULL DEFAULT false,
  prom_obtenido numeric(4,2),
  verificado boolean NOT NULL DEFAULT false,
  fecha_verificado timestamptz,
  beca_autorizada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alumno_id, ciclo_escolar)
);

CREATE INDEX becas_renovacion_ciclo_idx ON public.becas_renovacion (ciclo_escolar);

-- Hermanos capturados en el formulario (antes solo iban al PDF/correo)
CREATE TABLE public.becas_hermano (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  renovacion_id uuid NOT NULL REFERENCES public.becas_renovacion(id) ON DELETE CASCADE,
  orden smallint NOT NULL CHECK (orden BETWEEN 1 AND 4),
  nombre text,
  edad smallint,
  institucion text,
  colegiatura_mensual numeric(12,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (renovacion_id, orden)
);

CREATE INDEX becas_hermano_renovacion_idx ON public.becas_hermano (renovacion_id);

-- Documentos PDF en Storage
CREATE TABLE public.becas_documento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  renovacion_id uuid NOT NULL REFERENCES public.becas_renovacion(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('ingresos', 'domicilio', 'boleta', 'comp_inscripcion')),
  storage_bucket text NOT NULL DEFAULT 'becas-documentos',
  storage_key text NOT NULL,
  storage_url text,
  nombre_original text,
  subido_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (renovacion_id, tipo)
);

CREATE INDEX becas_documento_renovacion_idx ON public.becas_documento (renovacion_id);

-- Triggers updated_at (función built-in de InsForge)
CREATE TRIGGER becas_concepto_beca_updated_at
  BEFORE UPDATE ON public.becas_concepto_beca
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER becas_alumno_updated_at
  BEFORE UPDATE ON public.becas_alumno
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER becas_alumno_detalle_updated_at
  BEFORE UPDATE ON public.becas_alumno_detalle
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER becas_familiar_updated_at
  BEFORE UPDATE ON public.becas_familiar
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER becas_alumno_beca_updated_at
  BEFORE UPDATE ON public.becas_alumno_beca
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER becas_renovacion_updated_at
  BEFORE UPDATE ON public.becas_renovacion
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

CREATE TRIGGER becas_hermano_updated_at
  BEFORE UPDATE ON public.becas_hermano
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

-- Acceso solo vía Route Handlers con API key de servicio (no SDK público)
REVOKE ALL ON TABLE public.becas_concepto_beca FROM anon, authenticated;
REVOKE ALL ON TABLE public.becas_alumno FROM anon, authenticated;
REVOKE ALL ON TABLE public.becas_alumno_detalle FROM anon, authenticated;
REVOKE ALL ON TABLE public.becas_familiar FROM anon, authenticated;
REVOKE ALL ON TABLE public.becas_alumno_beca FROM anon, authenticated;
REVOKE ALL ON TABLE public.becas_renovacion FROM anon, authenticated;
REVOKE ALL ON TABLE public.becas_hermano FROM anon, authenticated;
REVOKE ALL ON TABLE public.becas_documento FROM anon, authenticated;

-- Seed del catálogo de tipos de beca (valores del sistema PHP)
INSERT INTO public.becas_concepto_beca (beca_id, beca_clase, beca_porcentaje_default, beca_promedio_requerido) VALUES
  (1,  'PEMEX',            20, 8.0),
  (2,  'SEP',               0, 0.0),
  (3,  'Winston',           0, 0.0),
  (4,  'Promedio',          0, 0.0),
  (5,  'Docencia',        100, 8.5),
  (6,  'Excelencia',       25, 9.5),
  (7,  'Por Familia',      20, 8.5),
  (8,  'Académica',        20, 9.0),
  (9,  'Socioeconómica',   25, 8.5),
  (10, 'Por 2 Hermanos',   15, 8.0),
  (11, 'Grupal',            0, 0.0),
  (12, 'Exalumno',          0, 0.0),
  (13, 'Por 3 Hermanos',   20, 8.0),
  (14, 'Vecinos',           0, 0.0),
  (15, 'IMSS',             20, 8.0),
  (16, 'CFE',              20, 8.0),
  (17, 'TELMEX',           20, 8.0);
