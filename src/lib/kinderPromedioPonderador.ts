/** Escala literal de inglés Kinder (`boleta_calificacionpkp`, materia AVERAGE).
 * Fuente: ENGLISH PRESCHOOL — E=10, VG=9, G=8, R=7, S=6, NI=5.
 */
export const PONDERADOR_LETRA_KINDER_EN: Record<string, number> = {
  E: 10,
  VG: 9,
  G: 8,
  R: 7,
  S: 6,
  NI: 5,
}

export function letraKinderEnANumero(raw: string): number | null {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase()
  if (!key || key === '----' || key === '-' || key === 'N/A') return null
  if (key in PONDERADOR_LETRA_KINDER_EN) return PONDERADOR_LETRA_KINDER_EN[key]
  const n = Number(key.replace(',', '.'))
  if (Number.isFinite(n) && n >= 0 && n <= 10) return n
  return null
}

export function formatearLetraKinderEn(raw: string | null | undefined): string {
  const key = String(raw ?? '')
    .trim()
    .toUpperCase()
  return key || '—'
}
