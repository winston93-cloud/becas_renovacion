/**
 * 2026-08-25 - Marca exención de boleta SEP (Maternal/Kinder, alumno sin boleta).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { forbidWrongAlumno, requireAcceso } from '@/lib/acceso-auth';
import { assertPortalAbierto } from '@/lib/portal-ventanas';
import { esMaternalOKinder1 } from '@/lib/documentos-requeridos';
import { buildSolicitudDocsContext } from '@/lib/solicitud-docs-context';

export async function PATCH(request: NextRequest) {
  try {
    const cerrado = assertPortalAbierto('solicitud');
    if (cerrado) {
      return NextResponse.json(cerrado, { status: 403 });
    }

    const auth = requireAcceso(request);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as {
      solicitud_id?: string;
      sin_boleta_sep?: boolean;
    };
    const solicitudId = String(body?.solicitud_id || '').trim();
    const sinBoletaSep = Boolean(body?.sin_boleta_sep);

    if (!solicitudId) {
      return NextResponse.json({ error: 'Falta solicitud_id.' }, { status: 400 });
    }

    const admin = getInsforgeAdmin();

    const { data: solicitud, error: solErr } = await admin.database
      .from('becas_solicitud')
      .select('id, alumno_id, enviado, sin_boleta_sep, beca_deseada_id')
      .eq('id', solicitudId)
      .maybeSingle();

    if (solErr) {
      return NextResponse.json({ error: solErr.message }, { status: 500 });
    }
    if (!solicitud) {
      return NextResponse.json({ error: 'Solicitud no encontrada.' }, { status: 404 });
    }

    const wrong = forbidWrongAlumno(auth.acceso, solicitud.alumno_id);
    if (wrong) return wrong;

    const { data: alumno, error: alErr } = await admin.database
      .from('alumno')
      .select('alumno_id, alumno_ref, alumno_nivel, alumno_grado')
      .eq('alumno_id', solicitud.alumno_id)
      .maybeSingle();

    if (alErr) {
      return NextResponse.json({ error: alErr.message }, { status: 500 });
    }
    if (!alumno) {
      return NextResponse.json({ error: 'Alumno no encontrado.' }, { status: 404 });
    }

    const nivel =
      alumno.alumno_nivel != null ? Number(alumno.alumno_nivel) : null;
    const grado =
      alumno.alumno_grado != null ? Number(alumno.alumno_grado) : null;

    if (!esMaternalOKinder1(nivel, grado)) {
      return NextResponse.json(
        {
          error:
            'La exención de boleta SEP solo aplica en Maternal o Kinder 1.',
        },
        { status: 400 }
      );
    }

    const ctxPrevio = await buildSolicitudDocsContext({
      alumno,
      solicitud,
    });

    if (ctxPrevio.alumno_reinscrito) {
      return NextResponse.json(
        {
          error:
            'Este alumno ya tiene promedio en el colegio; no aplica subir ni eximir boleta SEP.',
        },
        { status: 400 }
      );
    }

    const { error: updErr } = await admin.database
      .from('becas_solicitud')
      .update({ sin_boleta_sep: sinBoletaSep })
      .eq('id', solicitudId);

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }

    const ctx = await buildSolicitudDocsContext({
      alumno,
      solicitud: { ...solicitud, sin_boleta_sep: sinBoletaSep },
    });

    return NextResponse.json({
      success: true,
      sin_boleta_sep: sinBoletaSep,
      exento_boleta_sep: ctx.exento_boleta_sep,
      alumno_reinscrito: ctx.alumno_reinscrito,
      tipos_requeridos: ctx.tipos,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
