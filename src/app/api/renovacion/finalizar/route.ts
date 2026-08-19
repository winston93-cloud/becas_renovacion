/**
 * 2026-07-16 - Finaliza renovación y envía correo vía Nodemailer (SMTP institucional).
 * 2026-07-17 - Docs dinámicos por nivel; correo To por nivel (producción).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { forbidWrongAlumno, requireAcceso } from '@/lib/acceso-auth';
import { assertPortalRenovacionOExcepcionCompleta } from '@/lib/portal-renovacion-excepcion';
import { getCurrentSchoolCycle, getSchoolCycleLabel } from '@/lib/ciclo-escolar';
import { signDocLink } from '@/lib/doc-download-token';
import { sendMail } from '@/lib/mailer';
import {
  buildRenovacionEmailHtml,
  buildRenovacionEmailSubject,
  labelDocumentoTipo,
  labelNivel,
  resolveBecasMailRecipients,
} from '@/lib/email-renovacion';
import { docsRequeridos } from '@/lib/documentos-requeridos';
import { labelGrupo } from '@/lib/label-grupo';
import { labelGrado } from '@/lib/label-grado';

async function blobToBuffer(blob: Blob): Promise<Buffer> {
  return Buffer.from(await blob.arrayBuffer());
}

export async function POST(request: NextRequest) {
  try {
    const auth = requireAcceso(request);
    if (!auth.ok) return auth.response;

    const force = request.nextUrl.searchParams.get('force') === '1';
    const body = await request.json().catch(() => ({}));
    const renovacionId = String(body.renovacion_id || '').trim();

    if (!renovacionId) {
      return NextResponse.json(
        { error: 'Falta renovacion_id.' },
        { status: 400 }
      );
    }

    const admin = getInsforgeAdmin();

    const { data: renovacion, error: renErr } = await admin.database
      .from('becas_renovacion')
      .select('*')
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

    const cerrado = await assertPortalRenovacionOExcepcionCompleta(
      admin,
      Number(renovacion.alumno_id)
    );
    if (cerrado) {
      return NextResponse.json(cerrado, { status: 403 });
    }

    const wrong = forbidWrongAlumno(auth.acceso, renovacion.alumno_id);
    if (wrong) return wrong;

    if (renovacion.correo_enviado && !force) {
      return NextResponse.json({
        success: true,
        already_sent: true,
        email_id: renovacion.correo_id || null,
        message: 'El correo ya había sido enviado.',
      });
    }

    // 2026-07-16 - Solicitud PDF se generó al guardar el form (incluye sueldos sin persistirlos)
    const pdfSolicitudKey = renovacion.pdf_solicitud_key as string | null;
    if (!pdfSolicitudKey) {
      return NextResponse.json(
        {
          error:
            'Falta el PDF de solicitud. Vuelva a guardar el formulario antes de finalizar.',
        },
        { status: 400 }
      );
    }

    const alumnoId = Number(renovacion.alumno_id);
    const cicloBeca = Number(renovacion.ciclo_escolar);

    const [{ data: alumno, error: alumnoErr }, { data: becaRow }] =
      await Promise.all([
        admin.database
          .from('alumno')
          .select(
            'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo'
          )
          .eq('alumno_id', alumnoId)
          .maybeSingle(),
        admin.database
          .from('alumno_beca')
          .select('beca_id, beca_porcentaje')
          .eq('alumno_id', alumnoId)
          .eq('beca_ciclo_escolar', cicloBeca)
          .maybeSingle(),
      ]);

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
      flujo: 'renovacion',
      nivel,
      grado: gradoNum,
    });

    const { data: documentos, error: docsErr } = await admin.database
      .from('becas_documento')
      .select('id, tipo, storage_key, storage_bucket, nombre_original')
      .eq('renovacion_id', renovacionId);

    if (docsErr) {
      return NextResponse.json({ error: docsErr.message }, { status: 500 });
    }

    const docs = documentos || [];
    const byTipo = new Map(docs.map((d) => [d.tipo as string, d]));
    const missing = tiposRequeridos.filter((t) => !byTipo.has(t));
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Faltan documentos: ${missing.join(', ')}.` },
        { status: 400 }
      );
    }

    // 2026-07-22 - Producción: To por nivel + BCC sistemas3
    const recipients = resolveBecasMailRecipients(nivel);
    if (!recipients) {
      return NextResponse.json(
        {
          error:
            'No se pudo determinar el destinatario de correo: el alumno no tiene un nivel escolar válido (1–4).',
        },
        { status: 400 }
      );
    }
    const replyTo =
      process.env.BECAS_EMAIL_REPLY_TO?.trim() || recipients.to;

    let becaClase = 'Sin beca';
    let becaPorcentaje = 0;
    if (becaRow) {
      becaPorcentaje = Number(becaRow.beca_porcentaje) || 0;
      const { data: concepto } = await admin.database
        .from('becas_concepto_beca')
        .select('beca_clase')
        .eq('beca_id', Number(becaRow.beca_id))
        .maybeSingle();
      becaClase = concepto?.beca_clase || 'Sin beca';
    }

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

    const solicitudBuffer = await blobToBuffer(solicitudFile);

    const origin = request.nextUrl.origin;
    const docLinks = tiposRequeridos.map((tipo) => {
      const doc = byTipo.get(tipo)!;
      const token = signDocLink(String(doc.id));
      return {
        tipo,
        label: labelDocumentoTipo(tipo),
        url: `${origin}/api/renovacion/documentos/download?token=${encodeURIComponent(token)}`,
      };
    });

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

    attachments.push({
      filename: `solicitud-renovacion-${alumno.alumno_ref}.pdf`,
      content: solicitudBuffer,
      contentType: 'application/pdf',
    });

    const nombreCompleto =
      `${alumno.alumno_app || ''} ${alumno.alumno_apm || ''} ${alumno.alumno_nombre || ''}`.trim();
    const grado = labelGrado(nivel, alumno.alumno_grado);
    const grupo = labelGrupo(alumno.alumno_grupo);
    const cicloLabel = getSchoolCycleLabel(getCurrentSchoolCycle());

    const emailData = {
      alumnoNombre: nombreCompleto || 'Sin nombre',
      alumnoRef: String(alumno.alumno_ref),
      nivelLabel: labelNivel(nivel),
      gradoGrupo: `${grado} / ${grupo}`,
      cicloLabel,
      becaClase,
      becaPorcentaje,
      documentos: docLinks,
    };

    let messageId: string;
    try {
      const sent = await sendMail({
        to: recipients.to,
        bcc: recipients.bcc,
        replyTo,
        subject: buildRenovacionEmailSubject(emailData),
        html: buildRenovacionEmailHtml(emailData),
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

    const { error: updateErr } = await admin.database
      .from('becas_renovacion')
      .update({
        correo_enviado: true,
        correo_enviado_en: new Date().toISOString(),
        correo_id: messageId || null,
        solicitud: true,
        ingreso_mensual_padre: null,
        ingreso_mensual_madre: null,
      })
      .eq('id', renovacionId);

    if (updateErr) {
      return NextResponse.json({
        success: true,
        email_id: messageId,
        warning: `Correo enviado pero no se actualizó el flag: ${updateErr.message}`,
      });
    }

    return NextResponse.json({
      success: true,
      email_id: messageId,
      message: 'Renovación finalizada y correo enviado.',
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al finalizar renovación.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
