// 2026-10-07 - Copiado de BECAS-SEP-NUEVO/sistema para el módulo Beca SEP; mantener ambas copias iguales.
/**
 * 2026-10-03 — Comparación de nombres de alumnos (función pura).
 *
 * Las listas SEP y la base escriben distinto el mismo nombre: con o sin acentos, "Ma." por
 * "María", apellidos primero o al final, errores de dedo. Aquí se normalizan y se califican
 * para buscar por nombre en Alta, en el panel y en la carga de la lista.
 */

/** Palabras que no distinguen a nadie y se ignoran al comparar. */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'dos'])
/** Abreviaturas comunes en listas oficiales. */
const ABREVIATURAS: Record<string, string> = { ma: 'maria', fco: 'francisco', gpe: 'guadalupe' }

/** Minúsculas, sin acentos, ñ → n, sin puntuación, sin partículas y sin espacios dobles. */
export function normalizarNombre(s: unknown): string {
  return tokensNombre(s).join(' ')
}

/** Palabras normalizadas del nombre, en el orden en que vienen. */
export function tokensNombre(s: unknown): string[] {
  const limpio = String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
  if (!limpio) return []
  return limpio
    .split(' ')
    .map((t) => ABREVIATURAS[t] ?? t)
    .filter((t) => t && !PARTICULAS.has(t))
}

/** Distancia de edición (Levenshtein) entre dos palabras. */
export function distancia(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let previa = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const actual = [i]
    for (let j = 1; j <= b.length; j++) {
      actual[j] = Math.min(previa[j] + 1, actual[j - 1] + 1, previa[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    previa = actual
  }
  return previa[b.length]
}

/** 1 = palabra idéntica, 0.85 = un error de dedo (palabras de 5+ letras), 0 = distinta. */
function similitudPalabra(a: string, b: string): number {
  if (a === b) return 1
  if (Math.min(a.length, b.length) >= 5 && distancia(a, b) <= 1) return 0.85
  return 0
}

/**
 * Qué tanto se parece `buscado` a `candidato` (0 a 1), sin importar el orden de las palabras.
 * Cada palabra del candidato se usa una sola vez. 1 = mismas palabras exactas.
 */
export function puntajeNombre(buscado: unknown, candidato: unknown): number {
  const bs = tokensNombre(buscado)
  const cs = tokensNombre(candidato)
  if (!bs.length || !cs.length) return 0
  const usadas = new Set<number>()
  let suma = 0
  for (const b of bs) {
    let mejor = 0
    let idx = -1
    cs.forEach((c, i) => {
      if (usadas.has(i)) return
      const s = similitudPalabra(b, c)
      if (s > mejor) {
        mejor = s
        idx = i
      }
    })
    if (idx >= 0) usadas.add(idx)
    suma += mejor
  }
  const cobertura = suma / bs.length
  const sobrantes = cs.length - usadas.size
  return Math.round(cobertura * (sobrantes > 0 ? 0.95 : 1) * 1000) / 1000
}

/** Mismas palabras (en cualquier orden) después de normalizar. */
export function esMismoNombre(a: unknown, b: unknown): boolean {
  const x = tokensNombre(a).sort()
  const y = tokensNombre(b).sort()
  return x.length > 0 && x.length === y.length && x.every((t, i) => t === y[i])
}

/** Palabras útiles para buscar en la base (2+ letras, máximo 5). */
export function palabrasBusqueda(texto: unknown): string[] {
  return Array.from(new Set(tokensNombre(texto).filter((t) => t.length >= 2))).slice(0, 5)
}

export type CandidatoNombre<T> = { item: T; puntaje: number; exacto: boolean }

/** Ordena candidatos por parecido (exactos primero) y descarta los que no se parecen. */
export function rankearPorNombre<T>(
  buscado: string,
  items: T[],
  nombreDe: (t: T) => string,
  minimo = 0.5
): CandidatoNombre<T>[] {
  return items
    .map((item) => ({ item, puntaje: puntajeNombre(buscado, nombreDe(item)), exacto: esMismoNombre(buscado, nombreDe(item)) }))
    .filter((c) => c.exacto || c.puntaje >= minimo)
    .sort((a, b) => Number(b.exacto) - Number(a.exacto) || b.puntaje - a.puntaje)
}
