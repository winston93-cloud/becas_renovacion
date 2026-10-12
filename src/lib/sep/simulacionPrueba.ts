/**
 * 2026-10-12 - Datos de ejemplo solo para alumnos de prueba (p. ej. 29905).
 * Completan plan y precios para que Control Escolar pueda ver el cálculo y pulsar Aplicar.
 * No se escriben en pagos, becas, cobro ni en el conteo de alumnos reales.
 * 2026-10-12 - Pagos y beca de ejemplo (inscripción, cuota de padres, septiembre y beca PEMEX 20 %)
 * para ver cómo reacciona el cálculo; viven solo en memoria, nunca en pago_detalle ni en alumno_beca.
 * 2026-10-12 - La cuota de padres (mal etiquetada como 20 = Cambridge; en el ciclo 23 vale $0) se cambia por
 * la cuota de inicio de curso (00, agosto, $3,300 de Primaria). No es colegiatura: la SEP no la toca.
 * 2026-10-12 - Un escenario por alumno de prueba: LAURA PRUEBA (29905) con beca PEMEX 20 % y
 * ALAN PRUEBA (29904) sin beca previa, que pagó todo a precio completo.
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

/** Alumno de prueba sin beca previa (ALAN PRUEBA). */
export const REF_PRUEBA_SIN_BECA = 29904;

/**
 * Concepto = caracteres 6-7 de pago_referencia: 11 inscripción, 00 cuota de inicio de curso, 01 septiembre.
 * La cuota de inicio no es inscripción ni colegiatura: el cálculo SEP debe ignorarla.
 */
export const PAGOS_SIMULACION_PRUEBA: FilaPagoConcepto[] = [
  { concepto: '11', importe: PRECIOS_SIMULACION_PRUEBA.inscripcion, recargo: 0, fecha: '2026-07-15', cubiertos: 0 },
  { concepto: '00', importe: CUOTA_INICIO_SIMULACION, recargo: 0, fecha: '2026-08-10', cubiertos: 0 },
  { concepto: '01', importe: SEPTIEMBRE_CON_BECA, recargo: 0, fecha: '2026-09-08', cubiertos: 0 },
];

/** Los mismos pagos, pero septiembre a precio completo (sin beca). */
export const PAGOS_SIMULACION_SIN_BECA: FilaPagoConcepto[] = PAGOS_SIMULACION_PRUEBA.map((p) =>
  p.concepto === '01' ? { ...p, importe: PRECIOS_SIMULACION_PRUEBA.colegiatura11 } : p
);

type EscenarioPrueba = {
  beca: { becaId: number; clase: string; porcentaje: number } | null;
  pagos: FilaPagoConcepto[];
};

function escenario(alumnoRef: number): EscenarioPrueba {
  if (alumnoRef === REF_PRUEBA_SIN_BECA) return { beca: null, pagos: PAGOS_SIMULACION_SIN_BECA };
  return { beca: BECA_SIMULACION_PRUEBA, pagos: PAGOS_SIMULACION_PRUEBA };
}

export const RESUMEN_SIMULACION_PRUEBA = `Pagos de ejemplo: inscripción ${pesos(PRECIOS_SIMULACION_PRUEBA.inscripcion)}, cuota de inicio de curso ${pesos(
  CUOTA_INICIO_SIMULACION
)} y septiembre ${pesos(SEPTIEMBRE_CON_BECA)} (colegiatura de ${pesos(PRECIOS_SIMULACION_PRUEBA.colegiatura11)} con beca ${
  BECA_SIMULACION_PRUEBA.clase
} del ${BECA_SIMULACION_PRUEBA.porcentaje} %), plan de ${PLAN_SIMULACION} meses.`;

const RESUMEN_SIMULACION_SIN_BECA = `Pagos de ejemplo sin beca previa: inscripción ${pesos(
  PRECIOS_SIMULACION_PRUEBA.inscripcion
)}, cuota de inicio de curso ${pesos(CUOTA_INICIO_SIMULACION)} y septiembre ${pesos(
  PRECIOS_SIMULACION_PRUEBA.colegiatura11
)} (precio completo), plan de ${PLAN_SIMULACION} meses.`;

export function resumenSimulacionPrueba(alumnoRef: number): string {
  return alumnoRef === REF_PRUEBA_SIN_BECA ? RESUMEN_SIMULACION_SIN_BECA : RESUMEN_SIMULACION_PRUEBA;
}

export function pagosSimulacionPrueba(alumnoRef: number): FilaPagoConcepto[] {
  return escenario(alumnoRef).pagos.map((p) => ({ ...p }));
}

export function completarDatosSimulacionPrueba(datos: DatosAlumnoCiclo): DatosAlumnoCiclo {
  const e = escenario(datos.alumnoRef);
  return {
    ...datos,
    planBase: datos.planBase ?? PLAN_SIMULACION,
    precios: datos.precios ?? PRECIOS_SIMULACION_PRUEBA,
    preciosAnterior: datos.preciosAnterior ?? PRECIOS_SIMULACION_ANTERIOR,
    pagos: e.pagos.map((p) => ({ ...p })),
    becaActualBase: e.beca?.porcentaje ?? 0,
  };
}

/** Beca del colegio que «pierde» el alumno de prueba (null si no tenía). */
export function becaSustituidaSimulacion(ciclo: number, alumnoRef?: number): BecaSustituida | null {
  const beca = alumnoRef == null ? BECA_SIMULACION_PRUEBA : escenario(alumnoRef).beca;
  return beca ? { ...beca, ciclo } : null;
}
