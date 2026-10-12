/**
 * 2026-10-12 - Datos de ejemplo solo para alumnos de prueba (p. ej. 29905).
 * Completan plan y precios para que Control Escolar pueda ver el cálculo y pulsar Aplicar.
 * No se escriben en pagos, becas, cobro ni en el conteo de alumnos reales.
 * 2026-10-12 - Pagos y beca de ejemplo (inscripción, cuota de padres, septiembre y beca PEMEX 20 %)
 * para ver cómo reacciona el cálculo; viven solo en memoria, nunca en pago_detalle ni en alumno_beca.
 * 2026-10-12 - La cuota de padres (mal etiquetada como 20 = Cambridge; en el ciclo 23 vale $0) se cambia por
 * la cuota de inicio de curso (00, agosto, $3,300 de Primaria). No es colegiatura: la SEP no la toca.
 */
import type { DatosAlumnoCiclo, FilaPagoConcepto } from '@/lib/sep/core/evaluar';
import type { PreciosNivel } from '@/lib/sep/core/precios';
import { pesos } from '@/lib/sep/core/dinero';
import type { BecaSustituida } from '@/lib/sep/tipos';

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

const PLAN_SIMULACION = 11;

/** Beca de convenio que «tenía» el alumno de prueba antes de la SEP (PEMEX = beca_id 1). */
export const BECA_SIMULACION_PRUEBA = { becaId: 1, clase: 'PEMEX', porcentaje: 20 } as const;

const CUOTA_INICIO_SIMULACION = 3300;
const SEPTIEMBRE_CON_BECA = Math.round(PRECIOS_SIMULACION_PRUEBA.colegiatura11 * (1 - BECA_SIMULACION_PRUEBA.porcentaje / 100) * 100) / 100;

/**
 * Concepto = caracteres 6-7 de pago_referencia: 11 inscripción, 00 cuota de inicio de curso, 01 septiembre.
 * La cuota de inicio no es inscripción ni colegiatura: el cálculo SEP debe ignorarla.
 */
export const PAGOS_SIMULACION_PRUEBA: FilaPagoConcepto[] = [
  { concepto: '11', importe: PRECIOS_SIMULACION_PRUEBA.inscripcion, recargo: 0, fecha: '2026-07-15', cubiertos: 0 },
  { concepto: '00', importe: CUOTA_INICIO_SIMULACION, recargo: 0, fecha: '2026-08-10', cubiertos: 0 },
  { concepto: '01', importe: SEPTIEMBRE_CON_BECA, recargo: 0, fecha: '2026-09-08', cubiertos: 0 },
];

export const RESUMEN_SIMULACION_PRUEBA = `Pagos de ejemplo: inscripción ${pesos(PRECIOS_SIMULACION_PRUEBA.inscripcion)}, cuota de inicio de curso ${pesos(
  CUOTA_INICIO_SIMULACION
)} y septiembre ${pesos(SEPTIEMBRE_CON_BECA)} (colegiatura de ${pesos(PRECIOS_SIMULACION_PRUEBA.colegiatura11)} con beca ${
  BECA_SIMULACION_PRUEBA.clase
} del ${BECA_SIMULACION_PRUEBA.porcentaje} %), plan de ${PLAN_SIMULACION} meses.`;

export function completarDatosSimulacionPrueba(datos: DatosAlumnoCiclo): DatosAlumnoCiclo {
  return {
    ...datos,
    planBase: datos.planBase ?? PLAN_SIMULACION,
    precios: datos.precios ?? PRECIOS_SIMULACION_PRUEBA,
    preciosAnterior: datos.preciosAnterior ?? PRECIOS_SIMULACION_ANTERIOR,
    pagos: PAGOS_SIMULACION_PRUEBA.map((p) => ({ ...p })),
    becaActualBase: BECA_SIMULACION_PRUEBA.porcentaje,
  };
}

export function becaSustituidaSimulacion(ciclo: number): BecaSustituida {
  return { ...BECA_SIMULACION_PRUEBA, ciclo };
}
