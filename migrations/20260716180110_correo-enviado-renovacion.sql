-- 2026-07-16 - Flags de envío de correo al finalizar renovación.
ALTER TABLE public.becas_renovacion
  ADD COLUMN IF NOT EXISTS correo_enviado boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS correo_enviado_en timestamptz,
  ADD COLUMN IF NOT EXISTS correo_id text;
