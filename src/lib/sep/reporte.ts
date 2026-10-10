/**
 * 2026-10-09 - Ahora es el informe de Dirección General (el rol interno sigue llamándose `sistemas`).
 * 2026-10-07 - Reporte de Sistemas: todos los trámites Beca SEP del ciclo con el cálculo de hoy
 * contra lo aplicado, y el Excel con fórmulas (4 alumnos a la vez contra InsForge, solo lectura).
 */
import 'server-only';
import type { Alerta } from '@/lib/sep/core/alertas';
import type { FilaPagoConcepto } from '@/lib/sep/core/evaluar';
import type { EntradaHoja } from '@/lib/sep/core/hojaCalculo';
import { getSchoolCycleLabel } from '@/lib/ciclo-escolar';
import { libroCalculos, type FilaExcel } from '@/lib/sep/excel/libroCalculos';
import { calcularEnVivo, cicloSep, listarTodasSep, montoVigente, porcentajeEfectivo } from '@/lib/sep/servicio';
import { ETIQUETA_ESTADO_SEP, type SolicitudSep } from '@/lib/sep/tipos';

export type FilaReporte = {
  s: SolicitudSep;
  pct: number | null;
  /** Mensualidad con los pagos de hoy (null si no se pudo calcular). */
  calculadoHoy: number | null;
  /** Mensualidad aplicada vigente (ajuste manual o cálculo guardado). */
  aplicado: number | null;
  diferencia: number | null;
  alertas: Alerta[];
  entrada: EntradaHoja | null;
  nivel: number | null;
  colegiaturaOficial: number | null;
  inscripcionOficial: number | null;
  becaActualPct: number | null;
  /** 2026-10-09 - Pagos de colegiatura leídos hoy (para el tablero de Dirección General). */
  pagos: FilaPagoConcepto[] | null;
  error: string | null;
};

async function enLotes<T, R>(items: T[], tam: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += tam) out.push(...(await Promise.all(items.slice(i, i + tam).map(fn))));
  return out;
}

async function fila(s: SolicitudSep): Promise<FilaReporte> {
  const pct = porcentajeEfectivo(s);
  const aplicado = s.estado === 'aplicada' ? montoVigente(s) : null;
  const guardado = s.calculo;
  const base = {
    s,
    pct,
    aplicado,
    entrada: guardado?.entrada ?? null,
    nivel: guardado?.nivel ?? s.nivel,
    colegiaturaOficial: guardado?.entrada.colegiaturaOficial ?? null,
    inscripcionOficial: guardado?.entrada.inscripcionOficial ?? null,
    becaActualPct: guardado?.entrada.porcentajeBecaActual ?? null,
    alertas: guardado?.alertas ?? [],
    pagos: null,
  };
  if (pct == null) return { ...base, calculadoHoy: null, diferencia: null, error: 'Sin porcentaje.' };
  const c = await calcularEnVivo(s, pct);
  if (!c.ok) {
    return { ...base, calculadoHoy: null, diferencia: null, error: `${c.error} Se usa el cálculo guardado.` };
  }
  const hoy = c.entrada?.resultado.montoMensual ?? null;
  return {
    ...base,
    entrada: c.entrada ?? base.entrada,
    nivel: c.datos.nivelCiclo,
    colegiaturaOficial: c.evaluacion.colegiaturaOficial,
    inscripcionOficial: c.evaluacion.inscripcionOficial,
    becaActualPct: c.evaluacion.becaActualPct,
    alertas: c.evaluacion.alertas,
    pagos: c.datos.pagos,
    calculadoHoy: hoy,
    diferencia: hoy != null && aplicado != null ? Math.round((hoy - aplicado) * 100) / 100 : null,
    error: null,
  };
}

export async function reporteSistemas(): Promise<FilaReporte[]> {
  const todas = (await listarTodasSep()).filter((s) => s.estado !== 'rechazada');
  return enLotes(todas, 4, fila);
}

export async function excelSistemas(generadoPor: string): Promise<{ nombre: string; buffer: Buffer }> {
  const filas = await reporteSistemas();
  const excel: FilaExcel[] = filas.map((f) => ({
    alumnoRef: f.s.alumnoRef,
    nombre: f.s.nombreAlumno,
    nivel: f.nivel,
    planMeses: f.entrada?.planMeses ?? null,
    porcentajeSep: f.pct,
    porcentajeBecaActual: f.becaActualPct,
    colegiaturaOficial: f.colegiaturaOficial,
    inscripcionOficial: f.inscripcionOficial,
    entrada: f.entrada,
    estadoBeca: ETIQUETA_ESTADO_SEP[f.s.estado],
    montoAprobado: f.aplicado,
    alertas: f.alertas,
    fuente: f.error ? (f.entrada ? 'guardado' : 'sin_datos') : 'vivo',
    nota: f.error ?? undefined,
  }));
  const ciclo = getSchoolCycleLabel(cicloSep()).replace(/\s/g, '');
  const buffer = await libroCalculos(excel, {
    titulo: `Cálculos de Beca SEP · Ciclo ${getSchoolCycleLabel(cicloSep())}`,
    ciclo,
    generadoPor,
    fecha: new Date(),
  });
  return { nombre: `Calculos-Beca-SEP-${ciclo}.xlsx`, buffer };
}
