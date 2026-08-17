/**
 * PATCH revisión de un documento (ok / incorrecto / pendiente).
 * Body: { flujo, documento_id, revision_estado, revision_nota? }
 * Al marcar incorrecto: exige motivo y avisa a los papás por correo.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertNivelPermitido, requireAdmin } from '@/lib/admin-auth';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import {
  normalizarRevisionEstado,
  type RevisionEstadoDoc,
} from '@/lib/doc-revision';
import {
  clientMetaFromRequest,
  registrarAuditoria,
} from '@/lib/admin-auditoria';
import { nombreAlumnoAuditoria } from '@/lib/admin-auditoria-alumno';
import {
  portalBecasIngresoUrl,
  resolveAccesoAutorizadoDestinatarios,
} from '@/lib/email-acceso-autorizado';
import {
  buildDocIncorrectoEmailHtml,
  buildDocIncorrectoEmailSubject,
} from '@/lib/email-doc-incorrecto';
import { labelNivel } from '@/lib/email-renovacion';
import { labelGrupo } from '@/lib/label-grupo';
import { labelGrado } from '@/lib/label-grado';
import { labelDocRequerido } from '@/lib/documentos-requeridos';
import {
  getCicloBecaARenovar,
  getCurrentSchoolCycle,
  getSchoolCycleLabel,
} from '@/lib/ciclo-escolar';
import { sendMail, getMailFrom } from '@/lib/mailer';
import type { DocumentoTipo } from '@/lib/types';

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const flujo = String(body.flujo || '').trim();
    const documentoId = String(body.documento_id || '').trim();
    const estadoRaw = String(body.revision_estado || '').trim();
    const nota =
      typeof body.revision_nota === 'string'
        ? body.revision_nota.trim().slice(0, 500) || null
        : null;

    if (!documentoId || (flujo !== 'renovacion' && flujo !== 'solicitud')) {
      return NextResponse.json(
        { error: 'Parámetros inválidos (flujo, documento_id).' },
        { status: 400 }
      );
    }
    if (
      estadoRaw !== 'ok' &&
      estadoRaw !== 'incorrecto' &&
      estadoRaw !== 'pendiente'
    ) {
      return NextResponse.json(
        { error: 'revision_estado debe ser ok, incorrecto o pendiente.' },
        { status: 400 }
      );
    }
    const revision_estado = normalizarRevisionEstado(
      estadoRaw
    ) as RevisionEstadoDoc;

    if (revision_estado === 'incorrecto' && (!nota || nota.length < 5)) {
      return NextResponse.json(
        {
          error:
            'Indique el motivo de lo incorrecto (mínimo 5 caracteres) para avisar a los padres.',
        },
        { status: 400 }
      );
    }

    const db = getInsforgeAdmin();
    const tabla =
      flujo === 'renovacion' ? 'becas_documento' : 'becas_solicitud_documento';
    const parentTable =
      flujo === 'renovacion' ? 'becas_renovacion' : 'becas_solicitud';

    const { data: doc, error: docErr } = await db.database
      .from(tabla)
      .select(`id, tipo, ${flujo === 'renovacion' ? 'renovacion_id' : 'solicitud_id'}`)
      .eq('id', documentoId)
      .maybeSingle();

    if (docErr) {
      return NextResponse.json({ error: docErr.message }, { status: 500 });
    }
    if (!doc) {
      return NextResponse.json(
        { error: 'Documento no encontrado.' },
        { status: 404 }
      );
    }

    const parentId = String(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      flujo === 'renovacion' ? (doc as any).renovacion_id : (doc as any).solicitud_id
    );

    const { data: parent } = await db.database
      .from(parentTable)
      .select('id, alumno_id, verificado, ciclo_escolar')
      .eq('id', parentId)
      .maybeSingle();

    if (!parent) {
      return NextResponse.json(
        { error: 'Expediente no encontrado.' },
        { status: 404 }
      );
    }

    const { data: alumno } = await db.database
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo'
      )
      .eq('alumno_id', Number(parent.alumno_id))
      .maybeSingle();

    const forbid = assertNivelPermitido(auth.admin, alumno?.alumno_nivel);
    if (forbid) return forbid;

    const ahora = new Date().toISOString();
    const patchDoc: Record<string, unknown> = {
      revision_estado,
      revision_nota: revision_estado === 'incorrecto' ? nota : null,
      revisado_en: revision_estado === 'pendiente' ? null : ahora,
      revisado_por:
        revision_estado === 'pendiente' ? null : auth.admin.label,
    };

    const { data: updated, error: upErr } = await db.database
      .from(tabla)
      .update(patchDoc)
      .eq('id', documentoId)
      .select(
        'id, tipo, revision_estado, revision_nota, revisado_en, revisado_por'
      )
      .maybeSingle();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    // Si marcan incorrecto y el expediente ya estaba verificado, quitar verificación.
    let verificadoQuitado = false;
    if (revision_estado === 'incorrecto' && parent.verificado) {
      const { error: vErr } = await db.database
        .from(parentTable)
        .update({ verificado: false, fecha_verificado: null })
        .eq('id', parentId);
      if (!vErr) verificadoQuitado = true;
    }

    let emailAviso: {
      ok: boolean;
      to?: string;
      error?: string;
      skipped?: boolean;
    } | null = null;

    if (revision_estado === 'incorrecto' && alumno && nota) {
      try {
        const dest = await resolveAccesoAutorizadoDestinatarios({
          db: db.database,
          alumno_id: Number(alumno.alumno_id),
          alumno_ref: alumno.alumno_ref,
          alumno_app: alumno.alumno_app,
          alumno_apm: alumno.alumno_apm,
          alumno_nombre: alumno.alumno_nombre,
        });
        if (dest.sin_correo || dest.to.length === 0) {
          emailAviso = {
            ok: false,
            skipped: true,
            error: 'Sin correo de padres registrado.',
          };
        } else {
          const nombre = [
            alumno.alumno_app,
            alumno.alumno_apm,
            alumno.alumno_nombre,
          ]
            .map((p) => (p != null ? String(p).trim() : ''))
            .filter(Boolean)
            .join(' ');
          const grado = labelGrado(
            alumno.alumno_nivel as number | null,
            alumno.alumno_grado as number | null
          );
          const grupo = labelGrupo(
            alumno.alumno_grupo as number | string | null
          );
          const gradoGrupo =
            [grado, grupo].filter((p) => p && p !== '—').join(' / ') || '—';
          const cicloLabel =
            flujo === 'renovacion'
              ? getSchoolCycleLabel(getCurrentSchoolCycle())
              : getSchoolCycleLabel(
                  Number(parent.ciclo_escolar) || getCurrentSchoolCycle()
                );
          const tipoDoc = String(updated?.tipo || (doc as { tipo?: string }).tipo || '') as DocumentoTipo;
          const emailData = {
            alumnoNombre: nombre || `Alumno ${alumno.alumno_ref}`,
            alumnoRef: String(alumno.alumno_ref),
            nivelLabel: labelNivel(
              alumno.alumno_nivel != null ? Number(alumno.alumno_nivel) : null
            ),
            gradoGrupo,
            cicloLabel,
            documentoLabel: labelDocRequerido(tipoDoc),
            motivo: nota,
            portalUrl: portalBecasIngresoUrl({
              flujo: flujo as 'renovacion' | 'solicitud',
              alumnoRef: String(alumno.alumno_ref),
            }),
            flujo: flujo as 'renovacion' | 'solicitud',
          };
          await sendMail({
            to: dest.to,
            subject: buildDocIncorrectoEmailSubject(emailData),
            html: buildDocIncorrectoEmailHtml(emailData),
          });
          emailAviso = {
            ok: true,
            to: dest.to.join(', '),
          };
        }
      } catch (mailErr) {
        emailAviso = {
          ok: false,
          error:
            mailErr instanceof Error
              ? mailErr.message
              : 'No se pudo enviar el correo a los padres.',
        };
      }
    }

    const accionDoc =
      revision_estado === 'ok'
        ? 'documento.marcar_ok'
        : revision_estado === 'incorrecto'
          ? 'documento.marcar_incorrecto'
          : 'documento.quitar_rechazo';

    const meta = clientMetaFromRequest(request);
    await registrarAuditoria(auth.admin, {
      accion: accionDoc,
      entidad: 'documento',
      entidad_id: documentoId,
      alumno_id: alumno ? Number(alumno.alumno_id) : Number(parent.alumno_id),
      alumno_ref: alumno?.alumno_ref != null ? String(alumno.alumno_ref) : null,
      alumno_nombre: nombreAlumnoAuditoria(alumno),
      alumno_nivel: alumno?.alumno_nivel != null ? Number(alumno.alumno_nivel) : null,
      detalle: {
        flujo,
        tipo: updated?.tipo ?? (doc as { tipo?: string }).tipo,
        revision_estado,
        revision_nota: nota,
        expediente_id: parentId,
        verificado_quitado: verificadoQuitado,
        email_aviso: emailAviso,
        email_from: revision_estado === 'incorrecto' ? getMailFrom() : undefined,
        ciclo_origen_ref:
          flujo === 'renovacion' ? getCicloBecaARenovar() : undefined,
      },
      ...meta,
    });

    return NextResponse.json({
      ok: true,
      documento: updated,
      verificado_quitado: verificadoQuitado,
      email_aviso: emailAviso,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al guardar revisión.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
