/**
 * 2026-10-12 - Datos de ejemplo solo para alumnos de prueba (p. ej. 29905).
 * Completan plan y precios para que Control Escolar pueda ver el cálculo y pulsar Aplicar.
 * No se escriben en pagos, becas, cobro ni en el conteo de alumnos reales.
 */
import type { DatosAlumnoCiclo } from '@/lib/sep/core/evaluar';
import type { PreciosNivel } from '@/lib/sep/core/precios';

/** Precios de ejemplo (Primaria 2026-27), solo para el cálculo en pantalla. */
export const PRECIOS_SIMULACION_PRUEBA: PreciosNivel = {
  colegiatura10: 5470,
  colegiatura11: 4930,
  inscripcion: 5490,
};

const PRECIOS_SIMULACION_ANTERIOR: PreciosNivel = {
  colegiatura10: 4880,
  colegiatura11: 4400,
  inscripcion: 5083,
};

export const DETALLE_COBRO_SIMULACION =
  'SIMULACIÓN DE PRUEBA: no se escribió en cobro, pagos ni becas. Las cifras son de ejemplo y no existen en la tesorería.';

export function completarDatosSimulacionPrueba(datos: DatosAlumnoCiclo): DatosAlumnoCiclo {
  return {
    ...datos,
    planBase: datos.planBase ?? 11,
    precios: datos.precios ?? PRECIOS_SIMULACION_PRUEBA,
    preciosAnterior: datos.preciosAnterior ?? PRECIOS_SIMULACION_ANTERIOR,
    pagos: [],
    becaActualBase: null,
  };
}
