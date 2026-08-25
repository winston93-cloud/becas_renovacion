-- Autorización admin de beca → acceso futuro a firma electrónica.
-- No activa alumno_beca ni descuentos en cobro.

CREATE TABLE IF NOT EXISTS public.becas_autorizacion_firma (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumno_id integer NOT NULL REFERENCES public.alumno(alumno_id) ON DELETE CASCADE,
  ciclo_escolar integer NOT NULL,
  flujo text NOT NULL CHECK (flujo IN ('solicitud', 'renovacion')),
  expediente_id uuid NOT NULL,
  activo boolean NOT NULL DEFAULT true,
  autorizado_en timestamptz NOT NULL DEFAULT now(),
  autorizado_por text,
  revocado_en timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (alumno_id, ciclo_escolar)
);

CREATE INDEX IF NOT EXISTS becas_autorizacion_firma_activo_idx
  ON public.becas_autorizacion_firma (ciclo_escolar, activo)
  WHERE activo = true;

CREATE INDEX IF NOT EXISTS becas_autorizacion_firma_expediente_idx
  ON public.becas_autorizacion_firma (expediente_id);

COMMENT ON TABLE public.becas_autorizacion_firma IS
  'Registro de becas autorizadas por Control Escolar para habilitar firma electrónica (carta de aceptación).';

CREATE TRIGGER becas_autorizacion_firma_updated_at
  BEFORE UPDATE ON public.becas_autorizacion_firma
  FOR EACH ROW EXECUTE FUNCTION system.update_updated_at();

ALTER TABLE public.becas_autorizacion_firma ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.becas_autorizacion_firma FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS servicios_insforge_deny_anon ON public.becas_autorizacion_firma;
CREATE POLICY servicios_insforge_deny_anon ON public.becas_autorizacion_firma
  FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
REVOKE ALL ON public.becas_autorizacion_firma FROM anon, authenticated;
