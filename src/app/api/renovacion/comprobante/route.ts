/**
 * 2026-07-16 - GET comprobante PDF (carta) con QR del No. de Control.
 * 2026-07-17 - Completitud vía correo_enviado o docs requeridos según nivel.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { forbidWrongAlumno, requireAcceso } from '@/lib/acceso-auth';
import { assertPortalRenovacionOExcepcionPorRenovacionId } from '@/lib/portal-renovacion-excepcion';
import { getCurrentSchoolCycle, getSchoolCycleLabel } from '@/lib/ciclo-escolar';
import { buildComprobantePdf } from '@/lib/pdf/comprobante';
import { formatFechaEsMx } from '@/lib/pdf/map-data';
import { docsRequeridos } from '@/lib/documentos-requeridos';
import { labelGrupo } from '@/lib/label-grupo';
import { labelGrado } from '@/lib/label-grado';

export async function GET(request: NextRequest) {
  try {
    const auth = requireAcceso(request);
    if (!auth.ok) return auth.response;

    const renovacionId = (
      request.nextUrl.searchParams.get('renovacion_id') || ''
    ).trim();

    if (!renovacionId) {
      return NextResponse.json(
        { error: 'Falta renovacion_id.' },
        { status: 400 }
      );
    }

    const admin = getInsforgeAdmin();

    const cerrado = await assertPortalRenovacionOExcepcionPorRenovacionId(
      admin,
      renovacionId
    );
    if (cerrado) {
      return NextResponse.json(cerrado, { status: 403 });
    }

    const { data: renovacion, error: renErr } = await admin.database
      .from('becas_renovacion')
      .select('id, alumno_id, correo_enviado, correo_enviado_en')
      .eq('id', renovacionId)
      .maybeSingle();

    if (renErr) {
      return NextResponse.json({ error: renErr.message }, { status: 500 });
    }
    if (!renovacion) {
      return NextResponse.json(
        { error: 'Renovación no encontrada.' },
        { status: 404 }
      );
    }

    const wrong = forbidWrongAlumno(auth.acceso, renovacion.alumno_id);
    if (wrong) return wrong;

    const alumnoId = Number(renovacion.alumno_id);
    const { data: alumno, error: alumnoErr } = await admin.database
      .from('alumno')
      .select(
        'alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo'
      )
      .eq('alumno_id', alumnoId)
      .maybeSingle();

    if (alumnoErr) {
      return NextResponse.json({ error: alumnoErr.message }, { status: 500 });
    }
    if (!alumno) {
      return NextResponse.json(
        { error: 'Alumno no encontrado.' },
        { status: 404 }
      );
    }

    let docsOk = Boolean(renovacion.correo_enviado);
    if (!docsOk) {
      const requeridos = docsRequeridos({
        flujo: 'renovacion',
        nivel:
          alumno.alumno_nivel != null ? Number(alumno.alumno_nivel) : null,
        grado:
          alumno.alumno_grado != null ? Number(alumno.alumno_grado) : null,
      });
      const { data: docs } = await admin.database
        .from('becas_documento')
        .select('tipo')
        .eq('renovacion_id', renovacionId);
      const subidos = new Set((docs || []).map((d) => d.tipo));
      docsOk = requeridos.every((t) => subidos.has(t));
    }

    if (!docsOk) {
      return NextResponse.json(
        {
          error:
            'La renovación aún no está completa. Finalice la carga de documentos primero.',
        },
        { status: 400 }
      );
    }

    const nombreCompleto =
      `${alumno.alumno_app || ''} ${alumno.alumno_apm || ''} ${alumno.alumno_nombre || ''}`.trim();

    const pdf = await buildComprobantePdf({
      alumnoNombre: nombreCompleto || 'Sin nombre',
      alumnoRef: String(alumno.alumno_ref),
      grado: labelGrado(alumno.alumno_nivel, alumno.alumno_grado),
      grupo: labelGrupo(alumno.alumno_grupo),
      cicloLabel: getSchoolCycleLabel(getCurrentSchoolCycle()),
      fechaRegistro: formatFechaEsMx(
        renovacion.correo_enviado_en || new Date().toISOString()
      ),
    });

    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="comprobante-renovacion-${alumno.alumno_ref}.pdf"`,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al generar comprobante.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
