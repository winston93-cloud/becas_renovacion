/**
 * 2026-07-16 - Ciclos escolares para renovación de becas.
 * 2026-07-17 - Solicitud de beca (nuevo ingreso) usa getCurrentSchoolCycle()
 *              (ciclo calendario), NO getCicloBecaARenovar().
 *
 * A partir del 10 de julio inicia el ciclo calendario nuevo (ej. 23 = 2026-2027).
 * Las renovaciones operan sobre las becas del ciclo ANTERIOR (ej. 22):
 * ya estamos en el ciclo nuevo, se renuevan las becas antiguas.
 */
export function getCurrentSchoolCycle(): number {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const startYear =
    month > 7 || (month === 7 && day >= 10) ? year : year - 1;
  return startYear - 2003;
}

/**
 * 2026-07-16 - Ciclo de las becas a renovar = ciclo calendario - 1.
 * Ejemplo: calendario 23 → se buscan y registran renovaciones del ciclo 22.
 */
export function getCicloBecaARenovar(): number {
  return getCurrentSchoolCycle() - 1;
}

export function getSchoolCycleLabel(cycle?: number): string {
  // Por defecto el label visible es el ciclo calendario (nuevo), no el de origen
  const c = cycle ?? getCurrentSchoolCycle();
  const start = 2003 + c;
  return `${start} - ${start + 1}`;
}
