import { NextRequest, NextResponse } from 'next/server';
import { assertNivelPermitido, requireAdmin } from '@/lib/admin-auth';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { mapAlumnoRow } from '@/lib/admin-queries';
import { docsRequeridos, labelDocRequerido } from '@/lib/documentos-requeridos';
import {
  getCurrentSchoolCycle,
  getSchoolCycleLabel,
} from '@/lib/ciclo-escolar';
import { expedienteDocsTodosOk } from '@/lib/expediente-docs-ok';
import { normalizarRevisionEstado } from '@/lib/doc-revision';
import {
  clientMetaFromRequest,
  registrarAuditoria,
} from '@/lib/admin-auditoria';
import { nombreAlumnoAuditoria } from '@/lib/admin-auditoria-alumno';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;
    const db = getInsforgeAdmin();

    const { data: ren, error } = await db.database
      .from('becas_renovacion')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!ren) {
      return NextResponse.json(
        { error: 'Renovación no encontrada.' },
        { status: 404 }
      );
    }

    const { data: alumno, error: alErr } = await db.database
      .from('alumno')
      .select('*')
      .eq('alumno_id', Number(ren.alumno_id))
      .maybeSingle();

    if (alErr) {
      return NextResponse.json({ error: alErr.message }, { status: 500 });
    }
    if (!alumno) {
      return NextResponse.json(
        { error: 'Alumno no encontrado.' },
        { status: 404 }
      );
    }

    const forbid = assertNivelPermitido(auth.admin, alumno.alumno_nivel);
    if (forbid) return forbid;

    const { data: docs } = await db.database
      .from('becas_documento')
      .select(
        'id, tipo, nombre_original, storage_key, subido_en, revision_estado, revision_nota, revisado_en, revisado_por'
      )
      .eq('renovacion_id', id);

    const tipos = docsRequeridos({
      flujo: 'renovacion',
      nivel: alumno.alumno_nivel,
      grado: alumno.alumno_grado,
    });

    return NextResponse.json({
      renovacion: {
        id: String(ren.id),
        ciclo_escolar: Number(ren.ciclo_escolar),
        ciclo_label: getSchoolCycleLabel(getCurrentSchoolCycle()),
        motivo: ren.motivo || null,
        casa_tipo: ren.casa_tipo || null,
        observaciones: ren.observaciones || null,
        correo_enviado: Boolean(ren.correo_enviado),
        correo_enviado_en: ren.correo_enviado_en || null,
        verificado: Boolean(ren.verificado),
        fecha_verificado: ren.fecha_verificado || null,
        beca_autorizada: Boolean(ren.beca_autorizada),
        pdf_solicitud_key: ren.pdf_solicitud_key || null,
        flags_docs: Object.fromEntries(
          tipos.map((t) => [t, Boolean(ren[t])])
        ),
      },
      alumno: mapAlumnoRow(alumno),
      documentos: (docs || []).map((d) => ({
        id: String(d.id),
        tipo: d.tipo,
        label: labelDocRequerido(d.tipo as never) || d.tipo,
        nombre_original: d.nombre_original,
        subido_en: d.subido_en,
        revision_estado: normalizarRevisionEstado(d.revision_estado),
        revision_nota: d.revision_nota || null,
        revisado_en: d.revisado_en || null,
        revisado_por: d.revisado_por || null,
      })),
      docs_requeridos: tipos.map((t) => ({
        tipo: t,
        label: labelDocRequerido(t),
      })),
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al cargar renovación.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;
    const body = await request.json().catch(() => ({}));
    const db = getInsforgeAdmin();

    const { data: ren, error } = await db.database
      .from('becas_renovacion')
      .select('id, alumno_id')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!ren) {
      return NextResponse.json(
        { error: 'Renovación no encontrada.' },
        { status: 404 }
      );
    }

    const { data: alumno } = await db.database
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado'
      )
      .eq('alumno_id', Number(ren.alumno_id))
      .maybeSingle();

    const forbid = assertNivelPermitido(auth.admin, alumno?.alumno_nivel);
    if (forbid) return forbid;

    const patch: Record<string, unknown> = {};
    const accionesLog: string[] = [];
    if (typeof body.verificado === 'boolean') {
      if (body.verificado === true) {
        const gate = await expedienteDocsTodosOk({
          db,
          flujo: 'renovacion',
          expedienteId: id,
          nivel: alumno?.alumno_nivel,
          grado: alumno?.alumno_grado,
        });
        if (!gate.ok) {
          return NextResponse.json({ error: gate.motivo }, { status: 400 });
        }
      }
      patch.verificado = body.verificado;
      patch.fecha_verificado = body.verificado
        ? new Date().toISOString()
        : null;
      accionesLog.push(
        body.verificado
          ? 'renovacion.verificar'
          : 'renovacion.quitar_verificacion'
      );
    }
    if (typeof body.beca_autorizada === 'boolean') {
      patch.beca_autorizada = body.beca_autorizada;
      accionesLog.push(
        body.beca_autorizada
          ? 'renovacion.autorizar'
          : 'renovacion.quitar_autorizacion'
      );
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: 'Nada que actualizar.' },
        { status: 400 }
      );
    }

    const { data: updated, error: upErr } = await db.database
      .from('becas_renovacion')
      .update(patch)
      .eq('id', id)
      .select(
        'id, verificado, fecha_verificado, beca_autorizada'
      )
      .maybeSingle();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const meta = clientMetaFromRequest(request);
    for (const accion of accionesLog) {
      await registrarAuditoria(auth.admin, {
        accion,
        entidad: 'renovacion',
        entidad_id: id,
        alumno_id: alumno ? Number(alumno.alumno_id) : Number(ren.alumno_id),
        alumno_ref: alumno?.alumno_ref != null ? String(alumno.alumno_ref) : null,
        alumno_nombre: nombreAlumnoAuditoria(alumno),
        alumno_nivel: alumno?.alumno_nivel != null ? Number(alumno.alumno_nivel) : null,
        detalle: { cambios: patch, resultado: updated },
        ...meta,
      });
    }

    return NextResponse.json({ ok: true, renovacion: updated });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al actualizar.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
