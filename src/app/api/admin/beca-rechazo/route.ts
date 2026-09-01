/**
 * POST: vista previa o envío del correo de rechazo de beca a los padres.
 * JSON (preview) o multipart/form-data (envío con adjunto opcional).
 * Campos: flujo, expediente_id, enviar?, subject?, mensaje_texto?, archivo?
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertNivelPermitido, requireAdmin } from '@/lib/admin-auth';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import {
  clientMetaFromRequest,
  registrarAuditoria,
} from '@/lib/admin-auditoria';
import { nombreAlumnoAuditoria } from '@/lib/admin-auditoria-alumno';
import { resolveAccesoAutorizadoDestinatarios } from '@/lib/email-acceso-autorizado';
import {
  buildBecaRechazoEmailHtml,
  buildBecaRechazoEmailSubject,
  buildBecaRechazoMensajeTexto,
} from '@/lib/email-beca-rechazo';
import { labelNivel } from '@/lib/email-renovacion';
import { labelGrupo } from '@/lib/label-grupo';
import { labelGrado } from '@/lib/label-grado';
import {
  getCurrentSchoolCycle,
  getSchoolCycleLabel,
} from '@/lib/ciclo-escolar';
import { getMailFrom, sendMail, type MailAttachment } from '@/lib/mailer';

const MAX_ADJunto_BYTES = 8 * 1024 * 1024;
const ADJUNTO_MIME_OK = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

type BodyParsed = {
  flujo: string;
  expedienteId: string;
  enviar: boolean;
  subjectOverride: string | null;
  mensajeTexto: string | null;
  archivo: File | null;
};

async function parseRequestBody(request: NextRequest): Promise<BodyParsed> {
  const ct = request.headers.get('content-type') || '';
  if (ct.includes('multipart/form-data')) {
    const form = await request.formData();
    const archivoRaw = form.get('archivo');
    return {
      flujo: String(form.get('flujo') || '').trim(),
      expedienteId: String(form.get('expediente_id') || '').trim(),
      enviar: String(form.get('enviar') || '') === 'true',
      subjectOverride: (() => {
        const s = form.get('subject');
        return s == null ? null : String(s);
      })(),
      mensajeTexto: (() => {
        const s = form.get('mensaje_texto');
        return s == null ? null : String(s);
      })(),
      archivo:
        archivoRaw instanceof File && archivoRaw.size > 0 ? archivoRaw : null,
    };
  }

  const body = await request.json().catch(() => ({}));
  return {
    flujo: String(body.flujo || '').trim(),
    expedienteId: String(body.expediente_id || '').trim(),
    enviar: body.enviar === true,
    subjectOverride:
      body.subject != null ? String(body.subject) : null,
    mensajeTexto:
      body.mensaje_texto != null ? String(body.mensaje_texto) : null,
    archivo: null,
  };
}

async function adjuntoDesdeFile(
  file: File
): Promise<{ ok: true; attachment: MailAttachment } | { ok: false; error: string }> {
  if (file.size > MAX_ADJunto_BYTES) {
    return {
      ok: false,
      error: 'El adjunto no puede superar 8 MB.',
    };
  }
  const mime = (file.type || '').toLowerCase() || 'application/octet-stream';
  const name = (file.name || 'adjunto').trim() || 'adjunto';
  const ext = name.includes('.')
    ? name.slice(name.lastIndexOf('.')).toLowerCase()
    : '';
  const extOk = ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.doc', '.docx'].includes(
    ext
  );
  if (!ADJUNTO_MIME_OK.has(mime) && !extOk) {
    return {
      ok: false,
      error: 'Adjunto no permitido. Use PDF, imagen (JPG/PNG/WebP) o Word.',
    };
  }
  const buf = Buffer.from(await file.arrayBuffer());
  return {
    ok: true,
    attachment: {
      filename: name.slice(0, 180),
      content: buf,
      contentType: ADJUNTO_MIME_OK.has(mime) ? mime : undefined,
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const parsed = await parseRequestBody(request);
    const { flujo, expedienteId, enviar } = parsed;

    if (!expedienteId || (flujo !== 'renovacion' && flujo !== 'solicitud')) {
      return NextResponse.json(
        { error: 'Parámetros inválidos (flujo, expediente_id).' },
        { status: 400 }
      );
    }

    const db = getInsforgeAdmin();
    const parentTable =
      flujo === 'renovacion' ? 'becas_renovacion' : 'becas_solicitud';

    type ParentRenovacion = {
      id: string;
      alumno_id: number;
      correo_enviado: boolean | null;
      ciclo_escolar: number | null;
    };
    type ParentSolicitud = {
      id: string;
      alumno_id: number;
      enviado: boolean | null;
      ciclo_escolar: number | null;
    };

    const parentSelect =
      flujo === 'renovacion'
        ? 'id, alumno_id, correo_enviado, ciclo_escolar'
        : 'id, alumno_id, enviado, ciclo_escolar';

    const { data: parentRaw, error: pErr } = await db.database
      .from(parentTable)
      .select(parentSelect)
      .eq('id', expedienteId)
      .maybeSingle();

    if (pErr) {
      return NextResponse.json({ error: pErr.message }, { status: 500 });
    }
    if (!parentRaw) {
      return NextResponse.json(
        { error: 'Expediente no encontrado.' },
        { status: 404 }
      );
    }

    if (flujo === 'solicitud') {
      const parent = parentRaw as ParentSolicitud;
      if (!parent.enviado) {
        return NextResponse.json(
          {
            error:
              'La solicitud aún no está enviada; no hay trámite que rechazar.',
          },
          { status: 400 }
        );
      }
    } else {
      const parent = parentRaw as ParentRenovacion;
      if (!parent.correo_enviado) {
        return NextResponse.json(
          {
            error:
              'La renovación aún no fue enviada; no hay trámite que rechazar.',
          },
          { status: 400 }
        );
      }
    }

    const parent =
      flujo === 'solicitud'
        ? (parentRaw as ParentSolicitud)
        : (parentRaw as ParentRenovacion);

    const { data: alumno } = await db.database
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo'
      )
      .eq('alumno_id', Number(parent.alumno_id))
      .maybeSingle();

    if (!alumno) {
      return NextResponse.json(
        { error: 'Alumno no encontrado.' },
        { status: 404 }
      );
    }

    const forbid = assertNivelPermitido(auth.admin, alumno.alumno_nivel);
    if (forbid) return forbid;

    const dest = await resolveAccesoAutorizadoDestinatarios({
      db: db.database,
      alumno_id: Number(alumno.alumno_id),
      alumno_ref: alumno.alumno_ref,
      alumno_app: alumno.alumno_app,
      alumno_apm: alumno.alumno_apm,
      alumno_nombre: alumno.alumno_nombre,
    });

    const nombre = [
      alumno.alumno_app,
      alumno.alumno_apm,
      alumno.alumno_nombre,
    ]
      .map((p) => (p != null ? String(p).trim() : ''))
      .filter(Boolean)
      .join(' ');

    const cicloNum =
      parent.ciclo_escolar != null
        ? Number(parent.ciclo_escolar)
        : getCurrentSchoolCycle();

    const emailData = {
      alumnoNombre: nombre || 'Alumno',
      alumnoRef: String(alumno.alumno_ref ?? ''),
      nivelLabel: labelNivel(Number(alumno.alumno_nivel)),
      gradoGrupo: `${labelGrado(Number(alumno.alumno_nivel), Number(alumno.alumno_grado))} / ${labelGrupo(alumno.alumno_grupo)}`,
      cicloLabel: getSchoolCycleLabel(cicloNum),
      flujo: flujo as 'renovacion' | 'solicitud',
    };

    const mensajeDefault = buildBecaRechazoMensajeTexto(emailData);
    const mensajeTexto =
      parsed.mensajeTexto != null && parsed.mensajeTexto.trim()
        ? parsed.mensajeTexto.trim()
        : mensajeDefault;
    if (mensajeTexto.length > 12000) {
      return NextResponse.json(
        { error: 'El mensaje es demasiado largo (máx. 12 000 caracteres).' },
        { status: 400 }
      );
    }

    const subjectDefault = buildBecaRechazoEmailSubject(emailData);
    const subject =
      parsed.subjectOverride != null && parsed.subjectOverride.trim()
        ? parsed.subjectOverride.trim().slice(0, 200)
        : subjectDefault;
    const html = buildBecaRechazoEmailHtml(emailData, mensajeTexto);

    const preview = {
      subject,
      subject_default: subjectDefault,
      html,
      mensaje_texto: mensajeTexto,
      mensaje_default: mensajeDefault,
      from: getMailFrom(),
      destinatarios: dest.to,
      es_prueba: dest.es_prueba,
      sin_correo: dest.sin_correo,
      alumno: {
        nombre: emailData.alumnoNombre,
        ref: emailData.alumnoRef,
        nivel: emailData.nivelLabel,
        grado_grupo: emailData.gradoGrupo,
        ciclo: emailData.cicloLabel,
      },
    };

    if (!enviar) {
      return NextResponse.json({ ok: true, preview });
    }

    if (dest.sin_correo || dest.to.length === 0) {
      return NextResponse.json(
        {
          error: 'Sin correo de padres registrado.',
          preview,
        },
        { status: 400 }
      );
    }

    let attachments: MailAttachment[] | undefined;
    let adjuntoNombre: string | null = null;
    if (parsed.archivo) {
      const adj = await adjuntoDesdeFile(parsed.archivo);
      if (!adj.ok) {
        return NextResponse.json({ error: adj.error, preview }, { status: 400 });
      }
      attachments = [adj.attachment];
      adjuntoNombre = adj.attachment.filename;
    }

    let messageId = '';
    try {
      const sent = await sendMail({
        to: dest.to,
        subject,
        html,
        attachments,
      });
      messageId = sent.messageId;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'No se pudo enviar el correo.';
      return NextResponse.json({ error: msg, preview }, { status: 500 });
    }

    const meta = clientMetaFromRequest(request);
    await registrarAuditoria(auth.admin, {
      accion:
        flujo === 'renovacion'
          ? 'renovacion.rechazo_beca'
          : 'solicitud.rechazo_beca',
      entidad: flujo === 'renovacion' ? 'renovacion' : 'solicitud',
      entidad_id: expedienteId,
      alumno_id: Number(alumno.alumno_id),
      alumno_ref: alumno.alumno_ref != null ? String(alumno.alumno_ref) : null,
      alumno_nombre: nombreAlumnoAuditoria(alumno),
      alumno_nivel:
        alumno.alumno_nivel != null ? Number(alumno.alumno_nivel) : null,
      detalle: {
        email_to: dest.to.join(', '),
        email_subject: subject,
        email_id: messageId || null,
        es_prueba: dest.es_prueba,
        mensaje_editado: mensajeTexto !== mensajeDefault,
        adjunto: adjuntoNombre,
      },
      ...meta,
    });

    const ahoraRechazo = new Date().toISOString();
    const { error: rechazoErr } = await db.database
      .from(parentTable)
      .update({
        beca_rechazada: true,
        beca_rechazada_en: ahoraRechazo,
        beca_autorizada: false,
      })
      .eq('id', expedienteId);
    if (rechazoErr) {
      return NextResponse.json(
        {
          error: `Correo enviado, pero no se pudo marcar el expediente como rechazado: ${rechazoErr.message}`,
          enviado: true,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      enviado: true,
      email: {
        to: dest.to.join(', '),
        subject,
        message_id: messageId || null,
        adjunto: adjuntoNombre,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al procesar rechazo de beca.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
