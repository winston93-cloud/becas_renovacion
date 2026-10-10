// 2026-10-07 - Copiado de BECAS-SEP-NUEVO/sistema para el módulo Beca SEP (2026-10-10: sin la lista real de casos).
/**
 * 2026-09-30 — Casos del Excel 25-26 con errores de captura, divisor o montos escritos a mano.
 *
 * `resolucion`:
 *   - 'automatica': el motor tiene el valor correcto (error del Excel); se informa y se puede aprobar.
 *   - 'revision': Servicios Escolares debe confirmar antes de aprobar (alerta bloqueante).
 *
 * 2026-10-03 — Cada caso pertenece a un ciclo: en el ciclo 23 (2026-27) los mismos alumnos
 * ya no deben heredar alertas ni exclusiones del Excel 25-26.
 */

export type TipoCasoConocido =
  | 'error_divisor_excel'
  | 'monto_manual_excel'
  | 'captura_duplicada'
  | 'numero_control_dudoso'
  | 'portal_distinto_excel'
  | 'docente_100'

export type CasoConocido = {
  alumnoRef: number
  ciclo: number
  tipo: TipoCasoConocido
  resolucion: 'automatica' | 'revision'
  mensaje: string
  montoExcel?: number
  montoMotor?: number
}


/**
 * 2026-10-10 - El repositorio es público: la lista real del Excel 25-26 (ciclo 22, con números de
 * control y montos de familias) no se publica. Aquí queda vacía; en el ciclo 23 no aplica ningún caso.
 * Las pruebas cargan casos ficticios con `fijarCasosConocidos`.
 */
const clave = (alumnoRef: number, ciclo: number) => `${alumnoRef}-${ciclo}`

let casos: ReadonlyMap<string, CasoConocido> = new Map()

export function fijarCasosConocidos(lista: CasoConocido[]): void {
  casos = new Map(lista.map((c) => [clave(c.alumnoRef, c.ciclo), c]))
}

export const casoConocido = (alumnoRef: number, ciclo: number) => casos.get(clave(alumnoRef, ciclo)) ?? null
