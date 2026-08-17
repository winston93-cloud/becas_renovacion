/**
 * POST: avisa a los padres que falta un documento requerido
 * (p. ej. ingresos en beca de convenio ya enviada).
 * Body: { flujo, expediente_id, tipos?: string[] }
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertNivelPermitido, requireAdmin } from '@/lib/admin-auth';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import {
  clientMetaFromRequest,
  registrarAuditoria,
} from '@/lib/admin-auditoria';
import { nombreAlumnoAuditoria } from '@/lib/admin-auditoria-alumno';
import {
  portalBecasPublicUrl,
  resolveAccesoAutorizadoDestinatarios,
} from '@/lib/email-acceso-autorizado';
import {
  buildDocFaltanteEmailHtml,
  buildDocFaltanteEmailSubject,
} from '@/lib/email-doc-incorrecto';
import { labelNivel } from '@/lib/email-renovacion';
import { labelGrupo } from '@/lib/label-grupo';
import { labelGrado } from '@/lib/label-grado';
import {
  docsRequeridos,
  labelDocRequerido,
  TODOS_DOCUMENTO_TIPOS,
} from '@/lib/documentos-requeridos';
import {
  getCurrentSchoolCycle,
  getSchoolCycleLabel,
} from '@/lib/ciclo-escolar';
import { sendMail, getMailFrom } from '@/lib/mailer';
import type { DocumentoTipo } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const body = await request.json().catch(() => ({}));
    const flujo = String(body.flujo || '').trim();
    const expedienteId = String(body.expediente_id || '').trim();
    const tiposRaw = Array.isArray(body.tipos)
      ? body.tipos.map((t: unknown) => String(t || '').trim()).filter(Boolean)
      : [];

    if (!expedienteId || (flujo !== 'renovacion' && flujo !== 'solicitud')) {
      return NextResponse.json(
        { error: 'Parámetros inválidos (flujo, expediente_id).' },
        { status: 400 }
      );
    }

    const db = getInsforgeAdmin();
    const tabla =
      flujo === 'renovacion' ? 'becas_documento' : 'becas_solicitud_documento';
    const parentTable =
      flujo === 'renovacion' ? 'becas_renovacion' : 'becas_solicitud';
    const fk = flujo === 'renovacion' ? 'renovacion_id' : 'solicitud_id';

    type ParentRow = {
      id: string;
      alumno_id: number;
      verificado?: boolean | null;
      ciclo_escolar?: number | null;
      beca_deseada_id?: number | null;
      enviado?: boolean | null;
    };

    const { data: parentRaw, error: pErr } = await db.database
      .from(parentTable)
      .select('*')
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
    const parent = parentRaw as ParentRow;

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

    if (flujo === 'solicitud' && !parent.enviado) {
      return NextResponse.json(
        {
          error:
            'La solicitud aún no está enviada. El padre verá el documento al continuar el trámite.',
        },
        { status: 400 }
      );
    }

    const tiposRequeridos = docsRequeridos({
      flujo,
      nivel: alumno.alumno_nivel,
      grado: alumno.alumno_grado,
      becaId:
        flujo === 'solicitud' && parent.beca_deseada_id != null
          ? Number(parent.beca_deseada_id)
          : null,
    });

    const { data: docs, error: dErr } = await db.database
      .from(tabla)
      .select('tipo')
      .eq(fk, expedienteId);

    if (dErr) {
      return NextResponse.json({ error: dErr.message }, { status: 500 });
    }

    const subidos = new Set((docs || []).map((d) => String(d.tipo)));
    const faltantes = tiposRequeridos.filter((t) => !subidos.has(t));
    if (faltantes.length === 0) {
      return NextResponse.json(
        { error: 'No hay documentos requeridos faltantes en este expediente.' },
        { status: 400 }
      );
    }

    let aAvisar: DocumentoTipo[] = faltantes;
    if (tiposRaw.length > 0) {
      const pedidos: DocumentoTipo[] = [];
      for (const t of tiposRaw) {
        if (!TODOS_DOCUMENTO_TIPOS.includes(t as DocumentoTipo)) {
          return NextResponse.json(
            { error: `Tipo de documento inválido: ${t}` },
            { status: 400 }
          );
        }
        if (!faltantes.includes(t as DocumentoTipo)) {
          return NextResponse.json(
            {
              error: `El documento «${labelDocRequerido(t as DocumentoTipo)}» no está faltante.`,
            },
            { status: 400 }
          );
        }
        pedidos.push(t as DocumentoTipo);
      }
      aAvisar = pedidos;
    }

    const dest = await resolveAccesoAutorizadoDestinatarios({
      db: db.database,
      alumno_id: Number(alumno.alumno_id),
      alumno_ref: alumno.alumno_ref,
      alumno_app: alumno.alumno_app,
      alumno_apm: alumno.alumno_apm,
      alumno_nombre: alumno.alumno_nombre,
    });

    let emailAviso: {
      ok: boolean;
      to?: string;
      error?: string;
      skipped?: boolean;
    };

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
      const grupo = labelGrupo(alumno.alumno_grupo as number | string | null);
      const gradoGrupo =
        [grado, grupo].filter((p) => p && p !== '—').join(' / ') || '—';
      const cicloLabel = getSchoolCycleLabel(
        Number(parent.ciclo_escolar) || getCurrentSchoolCycle()
      );
      const emailData = {
        alumnoNombre: nombre || `Alumno ${alumno.alumno_ref}`,
        alumnoRef: String(alumno.alumno_ref),
        nivelLabel: labelNivel(
          alumno.alumno_nivel != null ? Number(alumno.alumno_nivel) : null
        ),
        gradoGrupo,
        cicloLabel,
        documentosLabels: aAvisar.map((t) => labelDocRequerido(t)),
        portalUrl: portalBecasPublicUrl(),
        flujo: flujo as 'renovacion' | 'solicitud',
      };
      try {
        await sendMail({
          to: dest.to,
          subject: buildDocFaltanteEmailSubject(emailData),
          html: buildDocFaltanteEmailHtml(emailData),
        });
        emailAviso = { ok: true, to: dest.to.join(', ') };
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

    const meta = clientMetaFromRequest(request);
    await registrarAuditoria(auth.admin, {
      accion: 'documento.avisar_faltante',
      entidad: 'documento',
      entidad_id: expedienteId,
      alumno_id: Number(alumno.alumno_id),
      alumno_ref: String(alumno.alumno_ref),
      alumno_nombre: nombreAlumnoAuditoria(alumno),
      alumno_nivel:
        alumno.alumno_nivel != null ? Number(alumno.alumno_nivel) : null,
      detalle: {
        flujo,
        tipos: aAvisar,
        expediente_id: expedienteId,
        email_aviso: emailAviso,
        email_from: getMailFrom(),
      },
      ...meta,
    });

    if (!emailAviso.ok) {
      return NextResponse.json(
        {
          error: emailAviso.error || 'No se pudo enviar el aviso.',
          email_aviso: emailAviso,
        },
        { status: emailAviso.skipped ? 400 : 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      tipos: aAvisar,
      email_aviso: emailAviso,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al avisar documento faltante.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
