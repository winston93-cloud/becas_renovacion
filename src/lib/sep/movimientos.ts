/**
 * 2026-10-09 - Movimientos Beca SEP → Renovaciones / Solicitudes.
 * Cuando Control Escolar aplica la SEP, la beca del colegio que tenía el alumno se pierde y NO se renueva
 * el ciclo siguiente: la familia debe hacer Solicitud nueva. Aquí se consulta ese movimiento.
 *
 * Nunca rompe Renovaciones: si el trámite SEP no está disponible (producción sin migración) o falla la
 * lectura, responde "sin movimiento" y el flujo de Renovaciones sigue igual que antes.
 */
import 'server-only';
import { getSchoolCycleLabel } from '@/lib/ciclo-escolar';
import { getSepRepo } from '@/lib/sep/repo';
import type { BecaSustituida, SolicitudSep } from '@/lib/sep/tipos';

export type MovimientoSep = {
  solicitudId: string;
  alumnoId: number;
  alumnoRef: number;
  nombreAlumno: string;
  nivel: number | null;
  grado: number | null;
  /** Ciclo en que se aplicó la SEP (y se perdió la otra beca). */
  ciclo: number;
  cicloLabel: string;
  porcentajeSep: number | null;
  aplicadaEn: string | null;
  becaSustituida: BecaSustituida | null;
};

function aMovimiento(s: SolicitudSep): MovimientoSep {
  return {
    solicitudId: s.id,
    alumnoId: s.alumnoId,
    alumnoRef: s.alumnoRef,
    nombreAlumno: s.nombreAlumno,
    nivel: s.nivel,
    grado: s.grado,
    ciclo: s.ciclo,
    cicloLabel: getSchoolCycleLabel(s.ciclo),
    porcentajeSep: s.porcentajeConfirmado,
    aplicadaEn: s.aplicadaEn,
    becaSustituida: s.becaSustituida ?? null,
  };
}

/** Becas SEP aplicadas que sustituyeron una beca del colegio, en los ciclos dados. */
export async function movimientosSep(f: { ciclos: number[]; niveles?: number[] }): Promise<MovimientoSep[]> {
  // 2026-10-10 - Ya no depende del modo local: el trámite vive en InsForge (becas_sep_solicitud).
  try {
    const listas = await Promise.all(
      f.ciclos.map((ciclo) => getSepRepo().listar({ ciclo, estados: ['aplicada'], niveles: f.niveles }))
    );
    return listas
      .flat()
      .filter((s) => s.becaSustituida)
      .map(aMovimiento);
  } catch (e) {
    console.error('[sep] movimientos', e);
    return [];
  }
}

/**
 * Movimiento SEP del alumno en el ciclo (null si no tiene Beca SEP aplicada ahí). Quien lo usa debe confirmar
 * que el alumno tenía beca del colegio en ese ciclo (alumno_beca); los trámites aplicados antes del 2026-10-09
 * no guardaron `becaSustituida`.
 */
export async function movimientoSepAlumno(alumnoId: number, ciclo: number): Promise<MovimientoSep | null> {
  try {
    const s = await getSepRepo().porAlumno(alumnoId, ciclo);
    return s?.estado === 'aplicada' ? aMovimiento(s) : null;
  } catch (e) {
    console.error('[sep] movimiento alumno', e);
    return null;
  }
}

/** Texto para Renovaciones y para la familia cuando su beca anterior se sustituyó por la SEP. */
export function textoBecaSustituida(m: MovimientoSep): string {
  const beca = m.becaSustituida
    ? `${m.becaSustituida.clase ? `${m.becaSustituida.clase} ` : ''}del ${m.becaSustituida.porcentaje} %`
    : 'del colegio';
  return `En el ciclo ${m.cicloLabel} se aplicó la Beca SEP${m.porcentajeSep != null ? ` del ${m.porcentajeSep} %` : ''} y la beca ${beca} se perdió. Esa beca no se renueva: si la familia la quiere de nuevo, debe hacer una Solicitud nueva.`;
}
