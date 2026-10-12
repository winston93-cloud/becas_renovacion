-- 2026-10-12 - Beca SEP: nuevo estado 'revertida' (Dirección General autorizó regresar a la beca del colegio).
-- Solo cambia la restricción de becas_sep_solicitud; no toca datos.
ALTER TABLE public.becas_sep_solicitud DROP CONSTRAINT IF EXISTS becas_sep_solicitud_estado_check;
ALTER TABLE public.becas_sep_solicitud
  ADD CONSTRAINT becas_sep_solicitud_estado_check
  CHECK (estado = ANY (ARRAY['borrador', 'enviada', 'correccion', 'aplicada', 'rechazada', 'revertida']));
