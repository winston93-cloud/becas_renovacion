/**
 * 2026-10-09 - Pagos de colegiatura después de aplicar la Beca SEP contra la mensualidad esperada.
 * Detecta si la familia pagó de menos o de más (sin contar recargos) en los meses que ya cobran con SEP.
 */
import { NOMBRE_CONCEPTO } from '@/lib/sep/core/ciclo';
import { r2 } from '@/lib/sep/core/dinero';
import type { FilaPagoConcepto } from '@/lib/sep/core/evaluar';
import { armarHojaCalculo } from '@/lib/sep/core/hojaCalculo';
import type { SolicitudSep } from '@/lib/sep/tipos';

/** Diferencias menores a $1 se consideran pagadas correctamente (redondeos). */
export const TOLERANCIA_PAGO = 1;

export type EstadoPagoSep = 'ok' | 'menos' | 'mas' | 'pendiente' | 'cubierto';

export type RevisionPago = {
  concepto: string;
  mes: string;
  esperado: number;
  /** Pagado sin recargos (null si todavía no paga ese mes). */
  pagadoNeto: number | null;
  recargo: number;
  fecha: string | null;
  diferencia: number | null;
  estado: EstadoPagoSep;
};

export type ResumenPagos = {
  filas: RevisionPago[];
  conDiferencia: RevisionPago[];
  deMenos: number;
  deMas: number;
};

/** Mensualidad esperada por concepto según el cálculo guardado (o el ajuste manual de Dirección General). */
export function esperadosDeCalculo(s: Pick<SolicitudSep, 'calculo' | 'ajusteManual'>): Record<string, number> {
  if (!s.calculo) return {};
  const hoja = armarHojaCalculo(s.calculo.entrada);
  const ajuste = s.ajusteManual?.monto;
  return Object.fromEntries(hoja.reparto.map((f) => [f.concepto, r2(ajuste ?? f.aPagar)]));
}

/**
 * Esperados al recalcular o ajustar: los meses ya pagados conservan lo que se esperaba cuando se pagaron;
 * los que faltan toman el monto nuevo.
 */
export function actualizarEsperados(
  previos: Record<string, number> | undefined,
  nuevos: Record<string, number>,
  pagos: FilaPagoConcepto[]
): Record<string, number> {
  const pagados = new Set(pagos.filter((p) => p.importe > 0 || p.cubiertos > 0).map((p) => p.concepto));
  const out: Record<string, number> = { ...(previos ?? {}) };
  for (const [c, monto] of Object.entries(nuevos)) {
    if (!(previos && c in previos && pagados.has(c))) out[c] = monto;
  }
  return out;
}

export function revisarPagos(esperados: Record<string, number>, pagos: FilaPagoConcepto[]): ResumenPagos {
  const porConcepto = new Map(pagos.map((p) => [p.concepto, p]));
  const filas: RevisionPago[] = Object.entries(esperados)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([concepto, esperado]) => {
      const p = porConcepto.get(concepto);
      const mes = NOMBRE_CONCEPTO[concepto] ?? `Concepto ${concepto}`;
      const base = { concepto, mes, esperado };
      if (!p || (p.importe <= 0 && p.cubiertos === 0)) {
        return { ...base, pagadoNeto: null, recargo: 0, fecha: null, diferencia: null, estado: 'pendiente' as const };
      }
      if (p.importe <= 0) {
        return { ...base, pagadoNeto: 0, recargo: 0, fecha: p.fecha || null, diferencia: null, estado: 'cubierto' as const };
      }
      const neto = r2(p.importe - p.recargo);
      const diferencia = r2(neto - esperado);
      const estado: EstadoPagoSep =
        Math.abs(diferencia) < TOLERANCIA_PAGO ? 'ok' : diferencia < 0 ? 'menos' : 'mas';
      return { ...base, pagadoNeto: neto, recargo: p.recargo, fecha: p.fecha || null, diferencia, estado };
    });
  const conDiferencia = filas.filter((f) => f.estado === 'menos' || f.estado === 'mas');
  return {
    filas,
    conDiferencia,
    deMenos: r2(conDiferencia.filter((f) => f.estado === 'menos').reduce((t, f) => t - (f.diferencia ?? 0), 0)),
    deMas: r2(conDiferencia.filter((f) => f.estado === 'mas').reduce((t, f) => t + (f.diferencia ?? 0), 0)),
  };
}
