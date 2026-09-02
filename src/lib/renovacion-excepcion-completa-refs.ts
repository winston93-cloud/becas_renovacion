/**
 * Excepción post-cierre: renovación completa (formulario, docs y envío).
 * Solo refs listados; distinto de la excepción por docs incorrectos.
 *
 * Quitar el ref cuando la familia termine o Mario indique.
 */
export const RENOVACION_EXCEPCION_COMPLETA_REFS: ReadonlySet<string> = new Set([
  '20868', // José Elías Román Aguillón — Primaria 6° — 2026-08-19
  '21769', // Luciana Mabel Román Aguillón — Kinder 2 — 2026-08-19
  '21089', // Georgette Alhelí Hernández Ramírez — Secundaria — 2026-09-02 (post-cierre CE)
  '21785', // Christian Gael Vivanco Rodríguez — Secundaria — 2026-09-02 (post-cierre CE)
  '21794', // SANTIAGO NORIEGA EDUARDO ALBERTO — Kinder 2 — 2026-09-02 (post-cierre CE)
]);

export function normalizarAlumnoRef(ref: string): string {
  return ref.replace(/\D/g, '').trim();
}

export function alumnoRefTieneExcepcionRenovacionCompleta(ref: string): boolean {
  const n = normalizarAlumnoRef(ref);
  return n.length > 0 && RENOVACION_EXCEPCION_COMPLETA_REFS.has(n);
}
