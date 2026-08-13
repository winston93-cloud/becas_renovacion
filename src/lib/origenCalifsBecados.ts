/**
 * Califs del ciclo de datos (ej. 22) vs ficha ya avanzada (ej. 23).
 *
 * El grado/nivel de la ficha es el actual; las boletas del ciclo elegido
 * corresponden al grado anterior (1° Primaria ← Kinder 3, 7mo ← 6° Primaria, …).
 */

export type FuentePromedioBecados = 'kinder' | 'primaria' | 'secundaria'

export type OrigenCalifsBecados = {
  fuente: FuentePromedioBecados
  /** Grado en el que se cursaron las califs del ciclo de datos. */
  gradoOrigen: number
  /** Nivel de la fuente: 2 Kinder, 3 Primaria, 4 Secundaria. */
  nivelOrigen: number
}

/**
 * Invierte el avance de ciclo: ficha actual → dónde están las califs del ciclo previo.
 *
 * Ejemplos (ficha en temporada N+1, califs de N):
 * - Kinder 2 ← Kinder 1; Kinder 3 ← Kinder 2
 * - 1° Primaria ← Kinder 3; 2°←1° … 6°←5°
 * - 7mo ← 6° Primaria; 8vo ← 7mo; 9no ← 8vo
 *
 * Nota operativa: becados ya en 7mo durante el ciclo de datos a menudo no
 * tienen filas en prim_* grado 6; la migración hace fallback a boleta
 * secundaria (ver scripts/migrar-promedio-ciclo-mysql-a-insforge.mjs).
 *
 * Kinder 1: sin año previo en boletas Kinder → null.
 */
export function origenCalifsDesdeFicha(
  nivelFicha: number,
  gradoFicha: number
): OrigenCalifsBecados | null {
  const nivel = Number(nivelFicha)
  const grado = Number(gradoFicha)

  if (nivel === 2) {
    if (grado <= 1) return null
    if (grado === 2) return { fuente: 'kinder', gradoOrigen: 1, nivelOrigen: 2 }
    if (grado === 3) return { fuente: 'kinder', gradoOrigen: 2, nivelOrigen: 2 }
    return null
  }

  if (nivel === 3) {
    if (grado === 1) return { fuente: 'kinder', gradoOrigen: 3, nivelOrigen: 2 }
    if (grado >= 2 && grado <= 6) {
      return { fuente: 'primaria', gradoOrigen: grado - 1, nivelOrigen: 3 }
    }
    return null
  }

  if (nivel === 4) {
    if (grado === 1) return { fuente: 'primaria', gradoOrigen: 6, nivelOrigen: 3 }
    if (grado === 2 || grado === 3) {
      return { fuente: 'secundaria', gradoOrigen: grado - 1, nivelOrigen: 4 }
    }
    return null
  }

  return null
}
