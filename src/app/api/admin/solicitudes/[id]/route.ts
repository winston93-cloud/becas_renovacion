import { NextRequest, NextResponse } from 'next/server';
import { assertNivelPermitido, requireAdmin } from '@/lib/admin-auth';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { mapAlumnoRow } from '@/lib/admin-queries';
import { docsRequeridos, labelDocRequerido } from '@/lib/documentos-requeridos';
import { getSchoolCycleLabel } from '@/lib/ciclo-escolar';
import { expedienteDocsTodosOk } from '@/lib/expediente-docs-ok';
import { normalizarRevisionEstado } from '@/lib/doc-revision';
import {
  clientMetaFromRequest,
  registrarAuditoria,
} from '@/lib/admin-auditoria';
import { nombreAlumnoAuditoria } from '@/lib/admin-auditoria-alumno';
import { syncAlumnoBecaPorAutorizacion } from '@/lib/sync-alumno-beca-autorizacion';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { id } = await ctx.params;
    const db = getInsforgeAdmin();

    const { data: sol, error } = await db.database
      .from('becas_solicitud')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!sol) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada.' },
        { status: 404 }
      );
    }

    const { data: alumno, error: alErr } = await db.database
      .from('alumno')
      .select('*')
      .eq('alumno_id', Number(sol.alumno_id))
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
      .from('becas_solicitud_documento')
      .select(
        'id, tipo, nombre_original, storage_key, subido_en, revision_estado, revision_nota, revisado_en, revisado_por'
      )
      .eq('solicitud_id', id);

    const beca_id =
      sol.beca_deseada_id != null ? Number(sol.beca_deseada_id) : null;
    const beca_porcentaje =
      sol.beca_porcentaje_deseado != null
        ? Number(sol.beca_porcentaje_deseado)
        : null;
    let beca_clase: string | null = null;
    if (beca_id != null && beca_id > 0) {
      const { data: concepto } = await db.database
        .from('becas_concepto_beca')
        .select('beca_clase')
        .eq('beca_id', beca_id)
        .maybeSingle();
      beca_clase = concepto?.beca_clase ? String(concepto.beca_clase) : null;
    }

    const tipos = docsRequeridos({
      flujo: 'solicitud',
      nivel: alumno.alumno_nivel,
      grado: alumno.alumno_grado,
      becaId: beca_id,
      becaClase: beca_clase,
    });

    return NextResponse.json({
      solicitud: {
        id: String(sol.id),
        ciclo_escolar: Number(sol.ciclo_escolar),
        ciclo_label: getSchoolCycleLabel(Number(sol.ciclo_escolar)),
        motivo: sol.motivo || null,
        enviado: Boolean(sol.enviado),
        enviado_en: sol.enviado_en || null,
        verificado: Boolean(sol.verificado),
        fecha_verificado: sol.fecha_verificado || null,
        beca_autorizada: Boolean(sol.beca_autorizada),
        pdf_solicitud_key: sol.pdf_solicitud_key || null,
        flags_docs: Object.fromEntries(
          tipos.map((t) => [t, Boolean(sol[t])])
        ),
      },
      alumno: mapAlumnoRow(alumno),
      beca: {
        beca_id,
        beca_clase,
        beca_porcentaje,
      },
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
      err instanceof Error ? err.message : 'Error al cargar solicitud.';
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

    const { data: sol, error } = await db.database
      .from('becas_solicitud')
      .select('id, alumno_id, beca_deseada_id, beca_porcentaje_deseado, verificado')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    if (!sol) {
      return NextResponse.json(
        { error: 'Solicitud no encontrada.' },
        { status: 404 }
      );
    }

    const { data: alumno } = await db.database
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado'
      )
      .eq('alumno_id', Number(sol.alumno_id))
      .maybeSingle();

    const forbid = assertNivelPermitido(auth.admin, alumno?.alumno_nivel);
    if (forbid) return forbid;

    const patch: Record<string, unknown> = {};
    const accionesLog: string[] = [];
    if (typeof body.verificado === 'boolean') {
      if (body.verificado === true) {
        const gate = await expedienteDocsTodosOk({
          db,
          flujo: 'solicitud',
          expedienteId: id,
          nivel: alumno?.alumno_nivel,
          grado: alumno?.alumno_grado,
          becaId:
            sol.beca_deseada_id != null ? Number(sol.beca_deseada_id) : null,
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
          ? 'solicitud.verificar'
          : 'solicitud.quitar_verificacion'
      );
    }
    if (typeof body.beca_autorizada === 'boolean') {
      if (body.beca_autorizada === true && !sol.verificado) {
        return NextResponse.json(
          {
            error:
              'No se puede autorizar la beca sin verificar el expediente primero.',
          },
          { status: 400 }
        );
      }
      patch.beca_autorizada = body.beca_autorizada;
      accionesLog.push(
        body.beca_autorizada
          ? 'solicitud.autorizar'
          : 'solicitud.quitar_autorizacion'
      );
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: 'Nada que actualizar.' },
        { status: 400 }
      );
    }

    if (typeof body.beca_autorizada === 'boolean') {
      const sync = await syncAlumnoBecaPorAutorizacion({
        db: db.database,
        alumnoId: Number(sol.alumno_id),
        autorizada: body.beca_autorizada,
        porcentajeFallback:
          sol.beca_porcentaje_deseado != null
            ? Number(sol.beca_porcentaje_deseado)
            : null,
        becaIdFallback:
          sol.beca_deseada_id != null ? Number(sol.beca_deseada_id) : null,
      });
      if (!sync.ok) {
        return NextResponse.json({ error: sync.error }, { status: 400 });
      }
    }

    const { data: updated, error: upErr } = await db.database
      .from('becas_solicitud')
      .update(patch)
      .eq('id', id)
      .select('id, verificado, fecha_verificado, beca_autorizada')
      .maybeSingle();

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const meta = clientMetaFromRequest(request);
    for (const accion of accionesLog) {
      await registrarAuditoria(auth.admin, {
        accion,
        entidad: 'solicitud',
        entidad_id: id,
        alumno_id: alumno ? Number(alumno.alumno_id) : Number(sol.alumno_id),
        alumno_ref: alumno?.alumno_ref != null ? String(alumno.alumno_ref) : null,
        alumno_nombre: nombreAlumnoAuditoria(alumno),
        alumno_nivel: alumno?.alumno_nivel != null ? Number(alumno.alumno_nivel) : null,
        detalle: { cambios: patch, resultado: updated },
        ...meta,
      });
    }

    return NextResponse.json({ ok: true, solicitud: updated });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al actualizar.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
