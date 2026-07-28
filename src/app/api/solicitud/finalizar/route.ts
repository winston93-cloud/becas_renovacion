/**
 * 2026-07-17 - Finaliza solicitud de beca: marca enviado y notifica por SMTP.
 * Docs dinámicos por nivel; adjunta PDFs subidos (como renovación).
 * To por nivel escolar (producción); BCC sistemas3.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { forbidWrongAlumno, requireAcceso } from '@/lib/acceso-auth';
import { assertPortalAbierto } from '@/lib/portal-ventanas';
import {
  getCurrentSchoolCycle,
  getSchoolCycleLabel,
} from '@/lib/ciclo-escolar';
import { tieneBecaActivaCicloPasado } from '@/lib/beca-elegibilidad';
import { sendMail } from '@/lib/mailer';
import { signDocLink } from '@/lib/doc-download-token';
import {
  labelDocumentoTipo,
  labelNivel,
  resolveBecasMailRecipients,
} from '@/lib/email-renovacion';
import {
  buildSolicitudEmailHtml,
  buildSolicitudEmailSubject,
  type DocLinkForSolicitudEmail,
} from '@/lib/email-solicitud';
import { labelGrupo } from '@/lib/label-grupo';
import { docsRequeridos } from '@/lib/documentos-requeridos';

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  return Buffer.from(await blob.arrayBuffer());
}

export async function POST(request: NextRequest) {
  try {
    const cerrado = assertPortalAbierto('solicitud');
    if (cerrado) {
      return NextResponse.json(cerrado, { status: 403 });
    }

    const auth = requireAcceso(request);
    if (!auth.ok) return auth.response;

    const body = (await request.json()) as { solicitud_id?: string };
    const solicitudId = String(body?.solicitud_id || '').trim();
    if (!solicitudId) {
      return NextResponse.json({ error: 'Falta solicitud_id.' }, { status: 400 });
    }

    const admin = getInsforgeAdmin();

    const { data: solicitud, error: solErr } = await admin.database
      .from('becas_solicitud')
      .select('id, alumno_id, enviado, pdf_solicitud_key')
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

    if (solicitud.enviado) {
      return NextResponse.json({
        success: true,
        ya_registrado: true,
        message: 'La solicitud ya había sido enviada.',
      });
    }

    // 2026-07-17 - PDF de formulario generado al guardar
    const pdfSolicitudKey = solicitud.pdf_solicitud_key as string | null;
    if (!pdfSolicitudKey) {
      return NextResponse.json(
        {
          error:
            'Falta el PDF de solicitud. Vuelva a guardar el formulario antes de finalizar.',
        },
        { status: 400 }
      );
    }

    // Defensa: beca activa del ciclo pasado → Renovación
    const becaCicloPasado = await tieneBecaActivaCicloPasado(
      admin.database,
      Number(solicitud.alumno_id)
    );
    if (!becaCicloPasado.ok) {
      return NextResponse.json({ error: becaCicloPasado.error }, { status: 500 });
    }
    if (becaCicloPasado.tiene) {
      return NextResponse.json(
        {
          error:
            'Este alumno tuvo beca el ciclo pasado. No se puede finalizar la solicitud nueva; use Renovación.',
          codigo: 'YA_TIENE_BECA',
        },
        { status: 403 }
      );
    }

    const { data: alumno, error: alumnoErr } = await admin.database
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo'
      )
      .eq('alumno_id', solicitud.alumno_id)
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

    const nivel =
      alumno.alumno_nivel != null ? Number(alumno.alumno_nivel) : null;
    const gradoNum =
      alumno.alumno_grado != null ? Number(alumno.alumno_grado) : null;
    // 2026-07-17 - Lista según maternal/kinder1 vs kinder2+
    const tiposRequeridos = docsRequeridos({
      flujo: 'solicitud',
      nivel,
      grado: gradoNum,
    });

    const { data: docs, error: docsErr } = await admin.database
      .from('becas_solicitud_documento')
      .select('id, tipo, storage_key, storage_bucket, nombre_original')
      .eq('solicitud_id', solicitudId);

    if (docsErr) {
      return NextResponse.json({ error: docsErr.message }, { status: 500 });
    }

    const byTipo = new Map((docs || []).map((d) => [d.tipo as string, d]));
    const faltantes = tiposRequeridos.filter((t) => !byTipo.has(t));
    if (faltantes.length > 0) {
      return NextResponse.json(
        {
          error: `Faltan documentos: ${faltantes.join(', ')}.`,
          faltantes,
        },
        { status: 400 }
      );
    }

    // 2026-07-22 - Producción: To por nivel + BCC sistemas3
    const recipients = resolveBecasMailRecipients(nivel);
    if (!recipients) {
      return NextResponse.json(
        {
          error:
            'No se pudo determinar el destinatario de correo: el alumno no tiene un nivel escolar válido.',
        },
        { status: 400 }
      );
    }

    // 2026-07-17 - Descargar PDFs y adjuntarlos (paridad con renovación)
    const attachments: {
      filename: string;
      content: Buffer;
      contentType: string;
    }[] = [];

    for (const tipo of tiposRequeridos) {
      const doc = byTipo.get(tipo)!;
      const bucket = doc.storage_bucket || 'becas-documentos';
      const { data: fileData, error: dlErr } = await admin.storage
        .from(bucket)
        .download(doc.storage_key);

      if (dlErr || !fileData) {
        return NextResponse.json(
          {
            error: `No se pudo leer el PDF "${tipo}": ${dlErr?.message || 'sin datos'}`,
          },
          { status: 500 }
        );
      }

      const safeName =
        (doc.nombre_original || `${tipo}.pdf`).replace(
          /[^a-zA-Z0-9._-]/g,
          '_'
        ) || `${tipo}.pdf`;

      attachments.push({
        filename: safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`,
        content: await blobToBuffer(fileData),
        contentType: 'application/pdf',
      });
    }

    // 2026-07-17 - Adjuntar PDF del formulario (encabezado Solicitud de Beca)
    const { data: solicitudFile, error: solDlErr } = await admin.storage
      .from('becas-documentos')
      .download(pdfSolicitudKey);

    if (solDlErr || !solicitudFile) {
      return NextResponse.json(
        {
          error:
            'No se pudo leer el PDF de solicitud. Vuelva a guardar el formulario antes de finalizar.',
        },
        { status: 400 }
      );
    }

    attachments.push({
      filename: `solicitud-beca-${alumno.alumno_ref}.pdf`,
      content: await blobToBuffer(solicitudFile),
      contentType: 'application/pdf',
    });

    const origin = request.nextUrl.origin;
    const docLinks: DocLinkForSolicitudEmail[] = tiposRequeridos.map((tipo) => {
      const doc = byTipo.get(tipo)!;
      const token = signDocLink(String(doc.id));
      return {
        tipo,
        label: labelDocumentoTipo(tipo),
        url: `${origin}/api/solicitud/documentos/download?token=${encodeURIComponent(token)}`,
      };
    });

    const nombreCompleto = [alumno.alumno_app, alumno.alumno_apm, alumno.alumno_nombre]
      .map((p) => (p != null ? String(p).trim() : ''))
      .filter(Boolean)
      .join(' ');
    const grado =
      alumno.alumno_grado != null ? String(alumno.alumno_grado) : '—';
    const grupo = labelGrupo(alumno.alumno_grupo);

    const emailData = {
      alumnoNombre: nombreCompleto || 'Sin nombre',
      alumnoRef: String(alumno.alumno_ref),
      nivelLabel: labelNivel(nivel),
      gradoGrupo: `${grado} / ${grupo}`,
      cicloLabel: getSchoolCycleLabel(getCurrentSchoolCycle()),
      documentos: docLinks,
    };

    let messageId = '';
    try {
      const sent = await sendMail({
        to: recipients.to,
        bcc: recipients.bcc,
        replyTo: process.env.BECAS_EMAIL_REPLY_TO?.trim() || recipients.to,
        subject: buildSolicitudEmailSubject(emailData),
        html: buildSolicitudEmailHtml(emailData),
        attachments,
      });
      messageId = sent.messageId;
    } catch (mailErr) {
      const msg =
        mailErr instanceof Error ? mailErr.message : 'Error SMTP desconocido';
      return NextResponse.json(
        { error: `No se pudo enviar el correo: ${msg}` },
        { status: 502 }
      );
    }

    const ahora = new Date().toISOString();
    const { error: updErr } = await admin.database
      .from('becas_solicitud')
      .update({ enviado: true, enviado_en: ahora })
      .eq('id', solicitudId);

    if (updErr) {
      // Correo ya salió; no fallar el trámite por el update
      return NextResponse.json({
        success: true,
        solicitud_id: solicitudId,
        enviado_en: ahora,
        correo_enviado: true,
        email_id: messageId || null,
        warning: updErr.message,
        message:
          'Correo enviado, pero no se pudo actualizar el estado de la solicitud. Contacte a sistemas.',
      });
    }

    return NextResponse.json({
      success: true,
      solicitud_id: solicitudId,
      enviado_en: ahora,
      correo_enviado: true,
      email_id: messageId || null,
      message:
        'Solicitud enviada correctamente. Coordinación revisará su expediente.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
