/**
 * 2026-10-07 - Punto único donde la Beca SEP aplicada llegará al cobro (servicios_admin / baucher).
 * Hoy NO escribe nada: el cobro sigue con integracionSep.ts y sepAplicaEnCicloCobro() apaga la SEP
 * desde el ciclo 23. Conectar aquí cuando se autorice (tabla becas_sep_solicitud + lectura en el baucher).
 */
import 'server-only';
import { pesos } from '@/lib/sep/core/dinero';
import { armarHojaCalculo } from '@/lib/sep/core/hojaCalculo';
import { esRefPruebaSep } from '@/lib/sep/activo';
import { DETALLE_COBRO_SIMULACION } from '@/lib/sep/simulacionPrueba';
import type { SolicitudSep } from '@/lib/sep/tipos';

export async function aplicarEnCobro(s: SolicitudSep): Promise<NonNullable<SolicitudSep['cobro']>> {
  const monto = s.ajusteManual?.monto ?? s.calculo?.montoMensual ?? null;
  const meses = s.calculo ? armarHojaCalculo(s.calculo.entrada).mesesPorPagar : [];
  const desde = meses[0] ?? null;
  // 2026-10-12 - Alumno de prueba: no se simula un cobro real (no hay dinero de tesorería).
  if (esRefPruebaSep(s.alumnoRef)) {
    return { estado: 'pendiente_integracion', detalle: DETALLE_COBRO_SIMULACION, fecha: new Date().toISOString() };
  }
  return {
    estado: 'pendiente_integracion',
    detalle: `Pendiente de integración con cobro: no se escribió en InsForge ni en servicios_admin. A cobrar ${pesos(monto)} por mes${desde ? ` desde ${desde} (${meses.length} meses)` : ''}.`,
    fecha: new Date().toISOString(),
  };
}
