-- Bitácora de movimientos del panel Control Escolar (quién / qué / cuándo).

CREATE TABLE IF NOT EXISTS public.becas_admin_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_role text NOT NULL,
  actor_label text NOT NULL,
  accion text NOT NULL,
  entidad text NOT NULL,
  entidad_id text,
  alumno_id integer,
  alumno_ref text,
  alumno_nombre text,
  alumno_nivel smallint,
  detalle jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS becas_admin_auditoria_created_idx
  ON public.becas_admin_auditoria (created_at DESC);

CREATE INDEX IF NOT EXISTS becas_admin_auditoria_accion_idx
  ON public.becas_admin_auditoria (accion);

CREATE INDEX IF NOT EXISTS becas_admin_auditoria_alumno_ref_idx
  ON public.becas_admin_auditoria (alumno_ref);

CREATE INDEX IF NOT EXISTS becas_admin_auditoria_nivel_idx
  ON public.becas_admin_auditoria (alumno_nivel);

COMMENT ON TABLE public.becas_admin_auditoria IS
  'Log de verificaciones, autorizaciones, permisos y revisiones de docs del admin becas.';

ALTER TABLE public.becas_admin_auditoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.becas_admin_auditoria FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.becas_admin_auditoria;
CREATE POLICY servicios_insforge_deny_anon ON public.becas_admin_auditoria
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.becas_admin_auditoria FROM anon, authenticated;
