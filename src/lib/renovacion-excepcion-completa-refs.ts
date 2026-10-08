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
  '21665', // BARRIOS DELGADO SARAH NICOLE — Kinder — 2026-09-03 (post-cierre, autorizado por DG, trámite extemporáneo)
  '21788', // MEZA CARDENAS MARCOS — Kinder 3 — 2026-09-04 (post-cierre CE, autorizado por DG desde octubre)
  '20508', // CAMILA MEZA TREJO — Secundaria — 2026-09-18 (post-cierre CE Secundaria)
  '20875', // IAN MALEK ORTIZ MORENO — Primaria 6° — 2026-09-28 (post-cierre, becado ciclo 22)
  // 2026-10-08 — Lista «becas fuera de tiempo» Primaria (Araceli, autorizada).
  '20595', // GARCIA CASTILLA ALEXA JOCELYN — Primaria 6° — Pemex
  '21343', // CRISTOBAL PEREZ JORGE ARCHIVALDO — Primaria 2° — Pemex
  '21349', // CRISTOBAL PEREZ GRETEL ALEJANDRA — Primaria 5° — Pemex
  '20376', // HERNANDEZ LEON SANTIAGO — Primaria 6° — Socioeconómica
  '20992', // RAMIREZ SANCHEZ IKER MATIAS — Primaria 6° — Hermanos
  '21092', // HERNANDEZ RAMIREZ JORGE PEDRO — Primaria 5° — Pemex
  '21604', // MARTINEZ ALVAREZ ALAN HIRAM — Primaria 4° — Pemex
  '21655', // BARRON PUGA MATIAS — Primaria 1° — Pemex
  '21648', // LOPEZ GONZALEZ NATALIE ABIGAIL — Primaria 3° — Pemex
  '21395', // CHAVEZ MATA PABLO EDMUNDO — Primaria 4° — Hermanos
  '21170', // RAMIREZ SANCHEZ DANIA SOFIA — Primaria 3° — Hermanos
  '21323', // PUGA DEL ANGEL REBECA SARAHI — Primaria 3° — Pemex
  '21531', // RODRIGUEZ GUTIERREZ JEXAN ENOC — Primaria 6° — Hermanos
  '21530', // RODRIGUEZ GUTIERREZ KEYLA XIMENA — Primaria 4° — Hermanos
  '21748', // DIAZ MALDONADO JOSUE — Primaria 2° — Hermanos
  '21749', // DIAZ MALDONADO CALEB — Secundaria 1° — Hermanos (hermano de Josué, misma lista)
]);

export function normalizarAlumnoRef(ref: string): string {
  return ref.replace(/\D/g, '').trim();
}

export function alumnoRefTieneExcepcionRenovacionCompleta(ref: string): boolean {
  const n = normalizarAlumnoRef(ref);
  return n.length > 0 && RENOVACION_EXCEPCION_COMPLETA_REFS.has(n);
}
