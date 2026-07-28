/**
 * Helpers para armar el contexto de alumno al escribir auditoría.
 */
export function nombreAlumnoAuditoria(a: {
  alumno_app?: string | null;
  alumno_apm?: string | null;
  alumno_nombre?: string | null;
} | null | undefined): string | null {
  if (!a) return null;
  const n = `${a.alumno_app || ''} ${a.alumno_apm || ''} ${a.alumno_nombre || ''}`.trim();
  return n || null;
}
