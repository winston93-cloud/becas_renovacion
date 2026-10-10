/**
 * 2026-10-07 - Beca SEP (familia): estado del trámite del alumno de la sesión.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAcceso } from '@/lib/acceso-auth';
import { getSchoolCycleLabel } from '@/lib/ciclo-escolar';
import { NOMBRE_NIVEL } from '@/lib/sep/core/ciclo';
import { estadoFamilia } from '@/lib/sep/servicio';
import { respuestaError, vistaFamilia } from '@/lib/sep/http';

export async function GET(request: NextRequest) {
  const ref = Number(request.nextUrl.searchParams.get('alumno_ref'));
  const auth = requireAcceso(request, Number.isFinite(ref) && ref > 0 ? ref : null);
  if (!auth.ok) return auth.response;
  try {
    const { alumno, ciclo, solicitud, bloqueo } = await estadoFamilia(auth.acceso.alumno_ref);
    return NextResponse.json({
      alumno: {
        alumno_ref: alumno.alumnoRef,
        nombre: alumno.nombre,
        nivel: alumno.nivel != null ? NOMBRE_NIVEL[alumno.nivel] ?? `Nivel ${alumno.nivel}` : null,
        grado: alumno.grado,
      },
      ciclo,
      ciclo_label: getSchoolCycleLabel(ciclo),
      solicitud: vistaFamilia(solicitud),
      // 2026-10-09 - Motivo por el que no puede tramitar (inactivo o sin inscripción en el ciclo); null si puede.
      bloqueo,
    });
  } catch (err) {
    return respuestaError(err, 'GET /api/sep');
  }
}
