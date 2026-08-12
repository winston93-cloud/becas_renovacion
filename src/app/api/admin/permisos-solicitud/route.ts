import { NextRequest, NextResponse } from 'next/server';
import { assertNivelPermitido, requireAdmin } from '@/lib/admin-auth';
import {
  fetchAlumnosByNivel,
  listPedidosAccesoSolicitud,
  mapAlumnoRow,
} from '@/lib/admin-queries';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import {
  clientMetaFromRequest,
  registrarAuditoria,
} from '@/lib/admin-auditoria';
import { nombreAlumnoAuditoria } from '@/lib/admin-auditoria-alumno';
import { sendMail, getMailFrom } from '@/lib/mailer';
import {
  getCurrentSchoolCycle,
  getSchoolCycleLabel,
} from '@/lib/ciclo-escolar';
import { labelNivel } from '@/lib/email-renovacion';
import { labelGrupo } from '@/lib/label-grupo';
import {
  buildAccesoAutorizadoEmailHtml,
  buildAccesoAutorizadoEmailSubject,
} from '@/lib/email-solicitud';
import {
  esAlumnoPruebaAcceso,
  fetchEmailsPadresPorAlumnos,
  portalBecasPublicUrl,
  resolveAccesoAutorizadoDestinatarios,
} from '@/lib/email-acceso-autorizado';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const sp = request.nextUrl.searchParams;
    const q = (sp.get('q') || '').trim();
    const soloPendientes = sp.get('pendientes') !== '0' && !q;

    let items;
    if (soloPendientes && !q) {
      items = await listPedidosAccesoSolicitud(auth.admin);
    } else {
      let alumnos = await fetchAlumnosByNivel(auth.admin.niveles);
      if (q) {
        const needle = q.toLowerCase();
        alumnos = alumnos.filter((a) => {
          const ref = String(a.alumno_ref || '');
          const nombre =
            `${a.alumno_app || ''} ${a.alumno_apm || ''} ${a.alumno_nombre || ''}`.toLowerCase();
          return ref.includes(needle) || nombre.includes(needle);
        });
      }
      items = alumnos.map(mapAlumnoRow);
    }

    items = items
      .sort((a, b) => {
        // Primero quienes pidieron acceso y aún no tienen permiso
        const pa =
          a.acceso_enviada && !a.permiso_solicitud
            ? 0
            : a.acceso_enviada
              ? 1
              : 2;
        const pb =
          b.acceso_enviada && !b.permiso_solicitud
            ? 0
            : b.acceso_enviada
              ? 1
              : 2;
        if (pa !== pb) return pa - pb;
        return Number(a.alumno_ref) - Number(b.alumno_ref);
      })
      .slice(0, 300);

    const db = getInsforgeAdmin();
    const emailsByAlumno = await fetchEmailsPadresPorAlumnos(
      db.database,
      items.map((i) => Number(i.alumno_id))
    );

    const itemsConCorreo = items.map((i) => {
      const esPrueba = esAlumnoPruebaAcceso({
        alumno_ref: i.alumno_ref,
        alumno_app: null,
        alumno_apm: null,
        alumno_nombre: i.nombre,
      });
      // nombre completo "JUAN PRUEBA PRUEBA" también detecta prueba
      const emails = esPrueba
        ? [
            process.env.BECAS_EMAIL_ACCESO_FAMILIA?.trim() ||
              'isc.escobedo@gmail.com',
          ]
        : emailsByAlumno.get(Number(i.alumno_id)) || [];
      return {
        ...i,
        emails_aviso: emails,
        es_prueba: esPrueba,
      };
    });

    return NextResponse.json({
      total: itemsConCorreo.length,
      pendientes_autorizar: itemsConCorreo.filter(
        (i) => i.acceso_enviada && !i.permiso_solicitud
      ).length,
      items: itemsConCorreo,
      email_aviso: {
        from: getMailFrom(),
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al listar permisos.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const alumnoId = Number(body.alumno_id);
    const permiso = body.permiso_solicitud;

    if (!Number.isFinite(alumnoId) || alumnoId <= 0) {
      return NextResponse.json(
        { error: 'alumno_id inválido.' },
        { status: 400 }
      );
    }
    if (typeof permiso !== 'boolean') {
      return NextResponse.json(
        { error: 'permiso_solicitud debe ser boolean.' },
        { status: 400 }
      );
    }

    const db = getInsforgeAdmin();
    const { data: alumno, error } = await db.database
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo, alumno_permiso_solicitud_beca, alumno_solicitud_acceso_enviada, alumno_solicitud_acceso_en'
      )
      .eq('alumno_id', alumnoId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!alumno) {
      return NextResponse.json(
        { error: 'Alumno no encontrado.' },
        { status: 404 }
      );
    }

    const forbid = assertNivelPermitido(auth.admin, alumno.alumno_nivel);
    if (forbid) return forbid;

    const yaTienePermiso = Number(alumno.alumno_permiso_solicitud_beca) === 1;
    const pidioAcceso = Number(alumno.alumno_solicitud_acceso_enviada) === 1;
    const tuvoPedido =
      pidioAcceso || Boolean(alumno.alumno_solicitud_acceso_en);

    // Solo se puede abrir el formulario si la familia ya pidió acceso (correo).
    if (permiso === true && !yaTienePermiso && !pidioAcceso) {
      return NextResponse.json(
        {
          error:
            'No se puede autorizar: este alumno aún no ha solicitado acceso desde el portal. Debe aparecer con la etiqueta «Pidió acceso».',
          codigo: 'SIN_PEDIDO_ACCESO',
        },
        { status: 400 }
      );
    }

    const { data: updated, error: upErr } = await db.database
      .from('alumno')
      .update({
        alumno_permiso_solicitud_beca: permiso ? 1 : 0,
        // Si se autoriza, limpia bandera de “esperando respuesta”
        // (conserva alumno_solicitud_acceso_en como historial del pedido).
        ...(permiso
          ? { alumno_solicitud_acceso_enviada: 0 }
          : {}),
      })
      .eq('alumno_id', alumnoId)
      .select(
        'alumno_id, alumno_permiso_solicitud_beca, alumno_solicitud_acceso_enviada, alumno_solicitud_acceso_en'
      )
      .maybeSingle();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }


    // Aviso institucional a la familia (remitente = correo masivo de servicios).
    let emailAviso: { ok: boolean; messageId?: string; to?: string; error?: string } | null =
      null;
    if (permiso === true && !yaTienePermiso) {
      const nombreCompleto = [
        alumno.alumno_app,
        alumno.alumno_apm,
        alumno.alumno_nombre,
      ]
        .map((p) => (p != null ? String(p).trim() : ''))
        .filter(Boolean)
        .join(' ');
      const nivel =
        alumno.alumno_nivel != null ? Number(alumno.alumno_nivel) : null;
      const grado =
        alumno.alumno_grado != null ? String(alumno.alumno_grado) : '—';
      const grupo = labelGrupo(alumno.alumno_grupo as number | null);
      const emailData = {
        alumnoNombre: nombreCompleto || 'Sin nombre',
        alumnoRef: String(alumno.alumno_ref),
        nivelLabel: labelNivel(nivel),
        gradoGrupo: `${grado} / ${grupo}`,
        cicloLabel: getSchoolCycleLabel(getCurrentSchoolCycle()),
        portalUrl: portalBecasPublicUrl(),
      };
      const recipients = await resolveAccesoAutorizadoDestinatarios({
        db: db.database,
        alumno_id: Number(alumno.alumno_id),
        alumno_ref: alumno.alumno_ref,
        alumno_app: alumno.alumno_app as string | null,
        alumno_apm: alumno.alumno_apm as string | null,
        alumno_nombre: alumno.alumno_nombre as string | null,
      });

      if (recipients.sin_correo || recipients.to.length === 0) {
        emailAviso = {
          ok: false,
          to: undefined,
          error:
            'No hay correo de padre/madre registrado para este alumno.',
        };
      } else {
        try {
          const sent = await sendMail({
            to: recipients.to,
            replyTo:
              process.env.BECAS_EMAIL_REPLY_TO?.trim() ||
              process.env.BECAS_EMAIL_TO?.trim() ||
              recipients.to[0],
            subject: buildAccesoAutorizadoEmailSubject(emailData),
            html: buildAccesoAutorizadoEmailHtml(emailData),
          });
          emailAviso = {
            ok: true,
            messageId: sent.messageId,
            to: recipients.to.join(', '),
          };
        } catch (mailErr) {
          emailAviso = {
            ok: false,
            to: recipients.to.join(', '),
            error:
              mailErr instanceof Error ? mailErr.message : 'Error SMTP',
          };
        }
      }
    }

    const meta = clientMetaFromRequest(request);
    await registrarAuditoria(auth.admin, {
      accion: permiso ? 'acceso.autorizar' : 'acceso.revocar',
      entidad: 'acceso',
      entidad_id: String(alumnoId),
      alumno_id: Number(alumno.alumno_id),
      alumno_ref: String(alumno.alumno_ref ?? ''),
      alumno_nombre: nombreAlumnoAuditoria(alumno),
      alumno_nivel: Number(alumno.alumno_nivel),
      detalle: {
        permiso_antes: yaTienePermiso,
        permiso_despues: permiso,
        pidio_acceso: pidioAcceso,
        tuvo_pedido: tuvoPedido,
        email_aviso: emailAviso,
        remitente: getMailFrom(),
      },
      ...meta,
    });

    return NextResponse.json({
      ok: true,
      alumno: updated,
      tuvo_pedido_acceso: tuvoPedido,
      email_aviso: emailAviso,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al actualizar permiso.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
