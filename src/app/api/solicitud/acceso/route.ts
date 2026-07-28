/**
 * 2026-07-17 - Estado y envío de “solicitar acceso” a beca nueva.
 * GET: consulta flags. POST: envía correo por nivel + marca alumno_solicitud_acceso_enviada.
 * 2026-07-28 - ya_tiene_beca = beca activa del ciclo pasado (no historial antiguo).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { requireAcceso } from '@/lib/acceso-auth';
import { assertPortalAbierto } from '@/lib/portal-ventanas';
import {
  getCurrentSchoolCycle,
  getSchoolCycleLabel,
} from '@/lib/ciclo-escolar';
import { tieneBecaActivaCicloPasado } from '@/lib/beca-elegibilidad';
import { sendMail } from '@/lib/mailer';
import {
  labelNivel,
  resolveBecasMailRecipients,
} from '@/lib/email-renovacion';
import { labelGrupo } from '@/lib/label-grupo';
import {
  buildSolicitudAccesoEmailHtml,
  buildSolicitudAccesoEmailSubject,
} from '@/lib/email-solicitud';

type AccesoEstado =
  | 'puede_solicitar'
  | 'esperando_respuesta'
  | 'autorizado'
  | 'ya_tiene_beca'
  | 'no_encontrado';

function parseAlumnoRef(raw: string | null): number | null {
  if (!raw || !/^\d+$/.test(raw.trim())) return null;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function loadAlumnoAcceso(alumnoRef: number) {
  const admin = getInsforgeAdmin();
  const { data: alumno, error } = await admin.database
    .from('alumno')
    .select(
      'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_status, alumno_permiso_solicitud_beca, alumno_solicitud_acceso_enviada, alumno_solicitud_acceso_en'
    )
    .eq('alumno_ref', alumnoRef)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!alumno || Number(alumno.alumno_status) === 0) {
    return { admin, alumno: null as null, estado: 'no_encontrado' as AccesoEstado };
  }

  // Solo el ciclo pasado obliga a Renovación; beca antepasada = solicitud nueva.
  const becaCicloPasado = await tieneBecaActivaCicloPasado(
    admin.database,
    Number(alumno.alumno_id)
  );
  if (!becaCicloPasado.ok) throw new Error(becaCicloPasado.error);
  if (becaCicloPasado.tiene) {
    return { admin, alumno, estado: 'ya_tiene_beca' as AccesoEstado };
  }

  if (Number(alumno.alumno_permiso_solicitud_beca) === 1) {
    return { admin, alumno, estado: 'autorizado' as AccesoEstado };
  }

  if (Number(alumno.alumno_solicitud_acceso_enviada) === 1) {
    return { admin, alumno, estado: 'esperando_respuesta' as AccesoEstado };
  }

  return { admin, alumno, estado: 'puede_solicitar' as AccesoEstado };
}

function mensajePublico(estado: AccesoEstado): string {
  switch (estado) {
    case 'puede_solicitar':
      return 'Puede solicitar acceso al área de becas del Instituto.';
    case 'esperando_respuesta':
      return 'Ya envió su solicitud de acceso. Por favor espere la respuesta del área de becas del Instituto.';
    case 'autorizado':
      return 'Su acceso fue autorizado. Puede continuar con el formulario de solicitud.';
    case 'ya_tiene_beca':
      return 'Este alumno tuvo beca el ciclo pasado. Su trámite correcto es Renovación, no Solicitud nueva.';
    case 'no_encontrado':
      return 'No se encontró un alumno activo con ese número de control.';
  }
}

/** GET /api/solicitud/acceso?alumno_ref= */
export async function GET(request: NextRequest) {
  try {
    const cerrado = assertPortalAbierto('solicitud');
    if (cerrado) {
      return NextResponse.json(cerrado, { status: 403 });
    }

    const alumnoRef = parseAlumnoRef(
      request.nextUrl.searchParams.get('alumno_ref')
    );
    if (alumnoRef == null) {
      return NextResponse.json(
        { error: 'Indique un número de control válido.' },
        { status: 400 }
      );
    }

    // 2026-07-22 - Exige login antes de consultar/solicitar acceso
    const auth = requireAcceso(request, alumnoRef);
    if (!auth.ok) return auth.response;

    const { alumno, estado } = await loadAlumnoAcceso(alumnoRef);
    if (estado === 'no_encontrado') {
      return NextResponse.json(
        { error: mensajePublico(estado), estado },
        { status: 404 }
      );
    }

    return NextResponse.json({
      estado,
      mensaje: mensajePublico(estado),
      alumno_ref: alumno!.alumno_ref,
      acceso_enviado_en: alumno!.alumno_solicitud_acceso_en || null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/solicitud/acceso { alumno_ref } — envía correo y marca flag */
export async function POST(request: NextRequest) {
  try {
    const cerrado = assertPortalAbierto('solicitud');
    if (cerrado) {
      return NextResponse.json(cerrado, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const alumnoRef = parseAlumnoRef(
      String(body?.alumno_ref ?? '').trim() || null
    );
    if (alumnoRef == null) {
      return NextResponse.json(
        { error: 'Indique un número de control válido.' },
        { status: 400 }
      );
    }

    // 2026-07-22 - Exige login antes de enviar solicitud de acceso
    const auth = requireAcceso(request, alumnoRef);
    if (!auth.ok) return auth.response;

    const { admin, alumno, estado } = await loadAlumnoAcceso(alumnoRef);

    if (estado === 'no_encontrado') {
      return NextResponse.json(
        { error: mensajePublico(estado), estado },
        { status: 404 }
      );
    }
    if (estado === 'ya_tiene_beca') {
      return NextResponse.json(
        { error: mensajePublico(estado), estado, codigo: 'YA_TIENE_BECA' },
        { status: 403 }
      );
    }
    if (estado === 'autorizado') {
      return NextResponse.json({
        success: true,
        estado,
        mensaje: mensajePublico(estado),
        puede_continuar: true,
      });
    }
    if (estado === 'esperando_respuesta') {
      return NextResponse.json({
        success: true,
        estado,
        mensaje: mensajePublico(estado),
        ya_enviado: true,
        acceso_enviado_en: alumno!.alumno_solicitud_acceso_en || null,
      });
    }

    // puede_solicitar
    const nivel =
      alumno!.alumno_nivel != null ? Number(alumno!.alumno_nivel) : null;
    // 2026-07-17 - Prueba: To sistemas3; BCC omitido si coincide
    const recipients = resolveBecasMailRecipients(nivel);
    if (!recipients) {
      return NextResponse.json(
        {
          error:
            'No se pudo determinar el área de becas correspondiente. Contacte a coordinación.',
        },
        { status: 400 }
      );
    }

    const nombreCompleto = [
      alumno!.alumno_app,
      alumno!.alumno_apm,
      alumno!.alumno_nombre,
    ]
      .map((p) => (p != null ? String(p).trim() : ''))
      .filter(Boolean)
      .join(' ');
    const grado =
      alumno!.alumno_grado != null ? String(alumno!.alumno_grado) : '—';
    const grupo = labelGrupo(alumno!.alumno_grupo);

    const emailData = {
      alumnoNombre: nombreCompleto || 'Sin nombre',
      alumnoRef: String(alumno!.alumno_ref),
      nivelLabel: labelNivel(nivel),
      gradoGrupo: `${grado} / ${grupo}`,
      cicloLabel: getSchoolCycleLabel(getCurrentSchoolCycle()),
    };

    let messageId = '';
    try {
      const sent = await sendMail({
        to: recipients.to,
        bcc: recipients.bcc,
        replyTo: process.env.BECAS_EMAIL_REPLY_TO?.trim() || recipients.to,
        subject: buildSolicitudAccesoEmailSubject(emailData),
        html: buildSolicitudAccesoEmailHtml(emailData),
      });
      messageId = sent.messageId;
    } catch (mailErr) {
      const msg =
        mailErr instanceof Error ? mailErr.message : 'Error SMTP desconocido';
      return NextResponse.json(
        { error: `No se pudo enviar la solicitud de acceso: ${msg}` },
        { status: 502 }
      );
    }

    const ahora = new Date().toISOString();
    const { error: updErr } = await admin.database
      .from('alumno')
      .update({
        alumno_solicitud_acceso_enviada: 1,
        alumno_solicitud_acceso_en: ahora,
      })
      .eq('alumno_id', alumno!.alumno_id);

    if (updErr) {
      return NextResponse.json(
        {
          error:
            'El correo se envió, pero no se pudo registrar el estado. Contacte a sistemas.',
          email_id: messageId || null,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      estado: 'esperando_respuesta' as AccesoEstado,
      mensaje: mensajePublico('esperando_respuesta'),
      email_id: messageId || null,
      acceso_enviado_en: ahora,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
