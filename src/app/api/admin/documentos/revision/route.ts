/**
 * PATCH revisión de un documento (ok / incorrecto / pendiente).
 * Body: { flujo, documento_id, revision_estado, revision_nota? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertNivelPermitido, requireAdmin } from '@/lib/admin-auth';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import {
  normalizarRevisionEstado,
  type RevisionEstadoDoc,
} from '@/lib/doc-revision';

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

    const db = getInsforgeAdmin();
    const tabla =
      flujo === 'renovacion' ? 'becas_documento' : 'becas_solicitud_documento';
    const fk = flujo === 'renovacion' ? 'renovacion_id' : 'solicitud_id';
    const parentTable =
      flujo === 'renovacion' ? 'becas_renovacion' : 'becas_solicitud';

    const { data: doc, error: docErr } = await db.database
      .from(tabla)
      .select(`id, ${fk}`)
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
      .select('id, alumno_id, verificado')
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
      .select('alumno_nivel')
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

    return NextResponse.json({
      ok: true,
      documento: updated,
      verificado_quitado: verificadoQuitado,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al guardar revisión.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
