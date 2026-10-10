// 2026-10-07 - Copiado de BECAS-SEP-NUEVO/sistema para el módulo Beca SEP; mantener ambas copias iguales.
/**
 * 2026-09-30 — Utilidades de dinero. Todo el motor redondea a centavos con r2.
 */

export const r2 = (n: number): number => Math.round((Number(n) || 0) * 100) / 100

export const igualCentavo = (a: number, b: number, tolerancia = 0.011) => Math.abs(a - b) <= tolerancia

const formato = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

/** $3,843.00 */
export const pesos = (n: number | null | undefined) => (n == null ? '—' : formato.format(n))
