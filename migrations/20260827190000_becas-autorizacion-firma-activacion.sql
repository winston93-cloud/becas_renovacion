-- Activación de beca tras firma electrónica (carta firmada en Storage).
ALTER TABLE public.becas_autorizacion_firma
  ADD COLUMN IF NOT EXISTS beca_activada boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS beca_activada_en timestamptz,
  ADD COLUMN IF NOT EXISTS firmado_por text,
  ADD COLUMN IF NOT EXISTS carta_firmada_bucket text,
  ADD COLUMN IF NOT EXISTS carta_firmada_key text,
  ADD COLUMN IF NOT EXISTS carta_firmada_url text;

CREATE INDEX IF NOT EXISTS becas_autorizacion_firma_activada_idx
  ON public.becas_autorizacion_firma (ciclo_escolar, beca_activada)
  WHERE beca_activada = true;

COMMENT ON COLUMN public.becas_autorizacion_firma.beca_activada IS
  'True cuando el padre envió la carta firmada (beca activada en portal).';
