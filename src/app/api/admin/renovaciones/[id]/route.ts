import { NextRequest, NextResponse } from 'next/server';
import { assertNivelPermitido, requireAdmin } from '@/lib/admin-auth';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { mapAlumnoRow } from '@/lib/admin-queries';
import { docsRequeridos, labelDocRequerido } from '@/lib/documentos-requeridos';
import {
  getCurrentSchoolCycle,
  getCicloBecaARenovar,
  getSchoolCycleLabel,
} from '@/lib/ciclo-escolar';
import { expedienteDocsTodosOk } from '@/lib/expediente-docs-ok';
import { normalizarRevisionEstado } from '@/lib/doc-revision';
import {
  clientMetaFromRequest,
  registrarAuditoria,
} from '@/lib/admin-auditoria';
import { nombreAlumnoAuditoria } from '@/lib/admin-auditoria-alumno';
import { registrarAutorizacionFirmaBeca } from '@/lib/registrar-autorizacion-firma-beca';
import { obtenerFirmaElectronicaExpediente } from '@/lib/firma-electronica-estado';
import { enviarAvisoBecaAutorizadaFirma } from '@/lib/enviar-aviso-beca-autorizada-firma';
import { cargarPromedioBecadoRenovacion } from '@/lib/promedioBecadoRenovacion';
import {
  actualizarBecaRenovacionAdmin,
  cargarConceptosBecaAdmin,
  filtrarConceptosTramitables,
  parsePatchBecaAdmin,
} from '@/lib/admin-beca-catalogo';
import {
  esBecaAcademica,
  parsePromedioMinimoCartaAdmin,
} from '@/lib/promedio-minimo-carta-beca';
import { parseSeguimientoIndividualizadoAdmin } from '@/lib/clausula-seguimiento-carta';

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

    // Beca del ciclo origen (la que se está renovando).
    const cicloBecaOrigen = getCicloBecaARenovar();
    const { data: becaRow } = await db.database
      .from('alumno_beca')
      .select('beca_id, beca_porcentaje, beca_estatus')
      .eq('alumno_id', Number(ren.alumno_id))
      .eq('beca_ciclo_escolar', cicloBecaOrigen)
      .maybeSingle();

    let beca_clase: string | null = null;
    const beca_porcentaje =
      becaRow?.beca_porcentaje != null ? Number(becaRow.beca_porcentaje) : null;
    const beca_id =
      becaRow?.beca_id != null ? Number(becaRow.beca_id) : null;

    if (beca_id != null && beca_id > 0) {
      const { data: concepto } = await db.database
        .from('becas_concepto_beca')
        .select('beca_clase')
        .eq('beca_id', beca_id)
        .maybeSingle();
      beca_clase = concepto?.beca_clase ? String(concepto.beca_clase) : null;
    }

    const alumnoMapped = mapAlumnoRow(alumno);
    const promedio = await cargarPromedioBecadoRenovacion({
      alumnoId: alumnoMapped.alumno_id,
      alumnoRef: alumnoMapped.alumno_ref,
      nivelFicha: Number(alumno.alumno_nivel),
      gradoFicha: Number(alumno.alumno_grado),
      cicloDatos: cicloBecaOrigen,
    });

    const conceptosRaw = await cargarConceptosBecaAdmin(db.database);
    const conceptos = filtrarConceptosTramitables(conceptosRaw, beca_id);

    const firma_electronica = await obtenerFirmaElectronicaExpediente({
      flujo: 'renovacion',
      expedienteId: String(ren.id),
      alumnoId: Number(ren.alumno_id),
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
      firma_electronica,
      alumno: alumnoMapped,
      beca: {
        beca_id,
        beca_clase,
        beca_porcentaje,
        promedio_minimo_carta:
          ren.promedio_minimo_carta != null
            ? Number(ren.promedio_minimo_carta)
            : null,
      },
      seguimiento_individualizado: Boolean(ren.seguimiento_individualizado),
      clausula_seguimiento_texto: ren.clausula_seguimiento_texto
        ? String(ren.clausula_seguimiento_texto)
        : null,
      promedio,
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
      conceptos,
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
      .select(
        'id, alumno_id, verificado, beca_autorizada, seguimiento_individualizado, clausula_seguimiento_texto'
      )
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
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo'
      )
      .eq('alumno_id', Number(ren.alumno_id))
      .maybeSingle();

    const forbid = assertNivelPermitido(auth.admin, alumno?.alumno_nivel);
    if (forbid) return forbid;

    const patch: Record<string, unknown> = {};
    const accionesLog: string[] = [];
    let detalleBecaCambio: Record<string, unknown> | null = null;

    const parsedBeca = parsePatchBecaAdmin(body);
    if (body.beca_id != null || body.beca_porcentaje != null) {
      if (!parsedBeca.ok) {
        return NextResponse.json({ error: parsedBeca.error }, { status: 400 });
      }

      const { data: becaOrigen } = await db.database
        .from('alumno_beca')
        .select('beca_id, beca_porcentaje')
        .eq('alumno_id', Number(ren.alumno_id))
        .eq('beca_ciclo_escolar', getCicloBecaARenovar())
        .maybeSingle();

      const becaUpd = await actualizarBecaRenovacionAdmin({
        db: db.database,
        alumnoId: Number(ren.alumno_id),
        alumnoRef: alumno?.alumno_ref,
        patch: parsedBeca.data,
      });
      if (!becaUpd.ok) {
        return NextResponse.json({ error: becaUpd.error }, { status: 400 });
      }

      detalleBecaCambio = {
        beca_id_anterior:
          becaOrigen?.beca_id != null ? Number(becaOrigen.beca_id) : null,
        beca_id_nuevo: parsedBeca.data.beca_id,
        porcentaje_anterior:
          becaOrigen?.beca_porcentaje != null
            ? Number(becaOrigen.beca_porcentaje)
            : null,
        porcentaje_nuevo: parsedBeca.data.beca_porcentaje,
        beca_autorizada: Boolean(ren.beca_autorizada),
      };
      if (!esBecaAcademica(parsedBeca.data.beca_id)) {
        patch.promedio_minimo_carta = null;
      }
      accionesLog.push('renovacion.cambiar_beca');
    }

    if (body.promedio_minimo_carta !== undefined) {
      let becaIdEff: number | null = null;
      if (parsedBeca.ok) {
        becaIdEff = parsedBeca.data.beca_id;
      } else {
        const { data: becaOrigen } = await db.database
          .from('alumno_beca')
          .select('beca_id')
          .eq('alumno_id', Number(ren.alumno_id))
          .eq('beca_ciclo_escolar', getCicloBecaARenovar())
          .maybeSingle();
        becaIdEff =
          becaOrigen?.beca_id != null ? Number(becaOrigen.beca_id) : null;
      }

      if (body.promedio_minimo_carta === null) {
        patch.promedio_minimo_carta = null;
      } else {
        const parsedProm = parsePromedioMinimoCartaAdmin({
          promedio_minimo_carta: body.promedio_minimo_carta,
          beca_id: becaIdEff,
        });
        if (!parsedProm.ok) {
          return NextResponse.json({ error: parsedProm.error }, { status: 400 });
        }
        patch.promedio_minimo_carta = parsedProm.value;
      }
      if (!accionesLog.includes('renovacion.cambiar_beca')) {
        accionesLog.push('renovacion.cambiar_beca');
      }
    }

    if (
      body.seguimiento_individualizado !== undefined ||
      body.clausula_seguimiento_texto !== undefined
    ) {
      const parsedSeg = parseSeguimientoIndividualizadoAdmin({
        seguimiento_individualizado:
          body.seguimiento_individualizado !== undefined
            ? body.seguimiento_individualizado
            : ren.seguimiento_individualizado,
        clausula_seguimiento_texto:
          body.clausula_seguimiento_texto !== undefined
            ? body.clausula_seguimiento_texto
            : ren.clausula_seguimiento_texto,
      });
      if (!parsedSeg.ok) {
        return NextResponse.json({ error: parsedSeg.error }, { status: 400 });
      }
      patch.seguimiento_individualizado = parsedSeg.activo;
      patch.clausula_seguimiento_texto = parsedSeg.texto;
      accionesLog.push(
        parsedSeg.activo
          ? 'renovacion.seguimiento_individualizado'
          : 'renovacion.quitar_seguimiento_individualizado'
      );
    }

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
      if (body.beca_autorizada === true && !ren.verificado) {
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
          ? 'renovacion.autorizar'
          : 'renovacion.quitar_autorizacion'
      );
    }

    if (Object.keys(patch).length === 0 && !detalleBecaCambio) {
      return NextResponse.json(
        { error: 'Nada que actualizar.' },
        { status: 400 }
      );
    }

    if (typeof body.beca_autorizada === 'boolean') {
      const reg = await registrarAutorizacionFirmaBeca({
        db: db.database,
        alumnoId: Number(ren.alumno_id),
        expedienteId: id,
        flujo: 'renovacion',
        autorizada: body.beca_autorizada,
        autorizadoPor: auth.admin.label,
      });
      if (!reg.ok) {
        return NextResponse.json({ error: reg.error }, { status: 400 });
      }
    }

    let emailAvisoFirma: Awaited<
      ReturnType<typeof enviarAvisoBecaAutorizadaFirma>
    > | null = null;
    /* INACTIVO: aviso a padres al autorizar beca (ver enviar-aviso-beca-autorizada-firma.ts)
    if (
      body.beca_autorizada === true &&
      !ren.beca_autorizada &&
      alumno
    ) {
      emailAvisoFirma = await enviarAvisoBecaAutorizadaFirma({
        db: db.database,
        flujo: 'renovacion',
        alumno: {
          alumno_id: Number(alumno.alumno_id),
          alumno_ref: alumno.alumno_ref,
          alumno_app: alumno.alumno_app as string | null,
          alumno_apm: alumno.alumno_apm as string | null,
          alumno_nombre: alumno.alumno_nombre as string | null,
          alumno_nivel: alumno.alumno_nivel as number | null,
          alumno_grado: alumno.alumno_grado as number | null,
          alumno_grupo: alumno.alumno_grupo as number | null,
        },
        cicloLabel: getSchoolCycleLabel(getCurrentSchoolCycle()),
      });
    }
    */

    let updated: Record<string, unknown> | null = null;
    if (Object.keys(patch).length > 0) {
      const { data: upd, error: upErr } = await db.database
        .from('becas_renovacion')
        .update(patch)
        .eq('id', id)
        .select('id, verificado, fecha_verificado, beca_autorizada')
        .maybeSingle();

      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
      updated = upd;
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
        detalle:
          accion === 'renovacion.cambiar_beca'
            ? { cambio_beca: detalleBecaCambio }
            : { cambios: patch, resultado: updated },
        ...meta,
      });
    }

    return NextResponse.json({
      ok: true,
      renovacion: updated,
      beca: detalleBecaCambio
        ? {
            beca_id: detalleBecaCambio.beca_id_nuevo,
            beca_porcentaje: detalleBecaCambio.porcentaje_nuevo,
          }
        : undefined,
      email_aviso_firma: emailAvisoFirma,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al actualizar.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
