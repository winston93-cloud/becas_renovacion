/**
 * Texto default y validación de la cláusula de seguimiento individualizado
 * en la carta de aceptación de beca.
 */

export const CLAUSULA_SEGUIMIENTO_DEFAULT =
  'La presente aceptación de beca incluye una condición de seguimiento individualizado para este expediente. El mantenimiento del apoyo económico estará condicionado estrictamente a [detallar la condición especial], evaluándose su cumplimiento al finalizar el periodo correspondiente.';

export function normalizarClausulaSeguimiento(
  value: unknown
): string | null {
  if (value == null) return null;
  const t = String(value).trim();
  if (!t) return null;
  if (t.length > 4000) return null;
  return t;
}

export function parseSeguimientoIndividualizadoAdmin(body: {
  seguimiento_individualizado?: unknown;
  clausula_seguimiento_texto?: unknown;
}):
  | { ok: true; activo: boolean; texto: string | null }
  | { ok: false; error: string } {
  const activo = Boolean(body.seguimiento_individualizado);

  if (!activo) {
    return { ok: true, activo: false, texto: null };
  }

  const raw =
    body.clausula_seguimiento_texto !== undefined
      ? body.clausula_seguimiento_texto
      : CLAUSULA_SEGUIMIENTO_DEFAULT;

  const texto = normalizarClausulaSeguimiento(raw);
  if (!texto) {
    return {
      ok: false,
      error:
        'Indique el texto de la cláusula de seguimiento individualizado (máx. 4000 caracteres).',
    };
  }

  return { ok: true, activo: true, texto };
}
