// 2026-10-07 - Copiado de BECAS-SEP-NUEVO/sistema para el módulo Beca SEP; mantener ambas copias iguales.
/**
 * 2026-10-03 — Revisión de precios oficiales de un nivel en un ciclo (función pura).
 * La usan las alertas de cada beca y la página "Ciclo" para detectar precios mal capturados
 * en `pago_boucher_precio` antes de calcular becas del ciclo nuevo.
 */

import { pesos } from './dinero'

export type PreciosNivel = { colegiatura10: number; colegiatura11: number; inscripcion: number }

/** Diferencia máxima aceptada entre el total anual del plan de 10 y el de 11 meses. */
export const TOLERANCIA_TOTAL_PLANES = 0.03
/** Aumento máximo esperado contra el ciclo anterior antes de avisar. */
export const AUMENTO_MAXIMO = 0.15

const pct = (x: number) => `${(x * 100).toFixed(1)} %`

/** Problemas encontrados en los precios; lista vacía si todo cuadra. */
export function revisarPrecios(p: PreciosNivel | null, anterior?: PreciosNivel | null): string[] {
  if (!p) return []
  const avisos: string[] = []
  if (!(p.colegiatura11 > 0)) avisos.push('La colegiatura del plan de 11 meses está vacía.')
  else if (p.colegiatura11 === p.colegiatura10) avisos.push(`La colegiatura de 11 meses es igual a la de 10 (${pesos(p.colegiatura10)}).`)
  if (p.colegiatura10 > 0 && p.colegiatura11 > 0) {
    const t10 = p.colegiatura10 * 10
    const t11 = p.colegiatura11 * 11
    const dif = Math.abs(t11 - t10) / t10
    if (dif > TOLERANCIA_TOTAL_PLANES) {
      avisos.push(`El total anual no cuadra entre planes: 10 meses ${pesos(t10)} y 11 meses ${pesos(t11)} (${pct(dif)} de diferencia).`)
    }
  }
  if (anterior) {
    const pares: [string, number, number][] = [
      ['colegiatura de 10 meses', p.colegiatura10, anterior.colegiatura10],
      ['colegiatura de 11 meses', p.colegiatura11, anterior.colegiatura11],
      ['inscripción', p.inscripcion, anterior.inscripcion],
    ]
    for (const [nombre, hoy, antes] of pares) {
      if (!(hoy > 0) || !(antes > 0)) continue
      const cambio = (hoy - antes) / antes
      if (cambio > AUMENTO_MAXIMO) avisos.push(`La ${nombre} subió ${pct(cambio)} contra el ciclo anterior (${pesos(antes)} → ${pesos(hoy)}).`)
      else if (cambio < 0) avisos.push(`La ${nombre} bajó contra el ciclo anterior (${pesos(antes)} → ${pesos(hoy)}).`)
    }
  }
  return avisos
}
