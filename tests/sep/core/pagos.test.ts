/**
 * 2026-10-09 - Pagos después de aplicar la Beca SEP: de menos / de más contra la mensualidad esperada.
 */
import { describe, expect, it } from 'vitest';
import type { FilaPagoConcepto } from '@/lib/sep/core/evaluar';
import { actualizarEsperados, revisarPagos } from '@/lib/sep/pagos';

const pago = (concepto: string, importe: number, recargo = 0, cubiertos = 0): FilaPagoConcepto => ({
  concepto,
  importe,
  recargo,
  fecha: '2026-10-05',
  cubiertos,
});

describe('revisarPagos', () => {
  const esperados = { '03': 4068.16, '04': 4068.16, '05': 4068.16, '06': 4068.16 };

  it('pago exacto, con recargo, de menos, de más y pendiente', () => {
    const r = revisarPagos(esperados, [pago('03', 4068.16), pago('04', 4268.16, 200), pago('05', 3500), pago('06', 4500)]);
    expect(r.filas.map((f) => f.estado)).toEqual(['ok', 'ok', 'menos', 'mas']);
    expect(r.deMenos).toBe(568.16);
    expect(r.deMas).toBe(431.84);
    expect(r.conDiferencia.map((f) => f.mes)).toEqual(['Enero', 'Febrero']);
  });

  it('diferencias de centavos (menos de $1) cuentan como correctas', () => {
    const r = revisarPagos({ '03': 4068.16 }, [pago('03', 4068)]);
    expect(r.filas[0].estado).toBe('ok');
    expect(r.conDiferencia).toHaveLength(0);
  });

  it('mes sin pago queda pendiente y mes cubierto a mano no es diferencia', () => {
    const r = revisarPagos({ '03': 4068.16, '04': 4068.16 }, [pago('04', 0, 0, 1)]);
    expect(r.filas.map((f) => f.estado)).toEqual(['pendiente', 'cubierto']);
    expect(r.deMenos).toBe(0);
  });
});

describe('actualizarEsperados', () => {
  it('los meses ya pagados conservan lo esperado; los que faltan toman el monto nuevo', () => {
    const previos = { '03': 4000, '04': 4000, '05': 4000 };
    const nuevos = { '03': 3900, '04': 3900, '05': 3900 };
    const out = actualizarEsperados(previos, nuevos, [pago('03', 4000)]);
    expect(out).toEqual({ '03': 4000, '04': 3900, '05': 3900 });
  });

  it('sin esperados previos usa los nuevos', () => {
    expect(actualizarEsperados(undefined, { '03': 3900 }, [pago('03', 4000)])).toEqual({ '03': 3900 });
  });
});
