import { NextRequest, NextResponse } from 'next/server';
import { assertNivelPermitido, requireAdmin } from '@/lib/admin-auth';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { mapAlumnoRow } from '@/lib/admin-queries';
import { labelDocRequerido } from '@/lib/documentos-requeridos';
import { buildSolicitudDocsContext } from '@/lib/solicitud-docs-context';
import { getCurrentSchoolCycle, getSchoolCycleLabel } from '@/lib/ciclo-escolar';
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
import { enviarAvisoCambioBecaAutorizada } from '@/lib/enviar-aviso-cambio-beca-autorizada';
import { huboCambioBecaAutorizada } from '@/lib/admin-beca-cambio';
import {
  becaYaActivadaEnCobro,
  sincronizarBecaCobroTrasCambioAdmin,
} from '@/lib/sincronizar-beca-cobro-cambio-admin';
import {
  actualizarBecaSolicitudAdmin,
  cargarConceptosBecaAdmin,
  filtrarConceptosTramitables,
  parsePatchBecaAdmin,
} from '@/lib/admin-beca-catalogo';
import {
  esBecaPromedioMinimoCartaEditable,
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

    const tiposCtx = await buildSolicitudDocsContext({
      alumno,
      solicitud: sol,
      becaClase: beca_clase,
    });
    const tipos = tiposCtx.tipos;

    const conceptosRaw = await cargarConceptosBecaAdmin(db.database);
    const conceptos = filtrarConceptosTramitables(conceptosRaw, beca_id);

    const firma_electronica = await obtenerFirmaElectronicaExpediente({
      flujo: 'solicitud',
      expedienteId: String(sol.id),
      alumnoId: Number(sol.alumno_id),
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
        beca_rechazada: Boolean(sol.beca_rechazada),
        beca_rechazada_en: sol.beca_rechazada_en || null,
        pdf_solicitud_key: sol.pdf_solicitud_key || null,
        flags_docs: Object.fromEntries(
          tipos.map((t) => [t, Boolean(sol[t])])
        ),
      },
      firma_electronica,
      alumno: mapAlumnoRow(alumno),
      beca: {
        beca_id,
        beca_clase,
        beca_porcentaje,
        promedio_minimo_carta:
          sol.promedio_minimo_carta != null
            ? Number(sol.promedio_minimo_carta)
            : null,
      },
      seguimiento_individualizado: Boolean(sol.seguimiento_individualizado),
      clausula_seguimiento_texto: sol.clausula_seguimiento_texto
        ? String(sol.clausula_seguimiento_texto)
        : null,
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
      promedio: tiposCtx.promedio,
      exento_boleta_sep: tiposCtx.exento_boleta_sep,
      alumno_reinscrito: tiposCtx.alumno_reinscrito,
      sin_boleta_sep: tiposCtx.sin_boleta_sep,
      conceptos,
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
      .select(
        'id, alumno_id, beca_deseada_id, beca_porcentaje_deseado, verificado, beca_autorizada, seguimiento_individualizado, clausula_seguimiento_texto'
      )
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
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo'
      )
      .eq('alumno_id', Number(sol.alumno_id))
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

      const becaUpd = await actualizarBecaSolicitudAdmin({
        db: db.database,
        solicitudId: id,
        patch: parsedBeca.data,
      });
      if (!becaUpd.ok) {
        return NextResponse.json({ error: becaUpd.error }, { status: 400 });
      }

      const yaActivadaCobro = await becaYaActivadaEnCobro({
        db: db.database,
        alumnoId: Number(sol.alumno_id),
        expedienteId: id,
        flujo: 'solicitud',
      });

      let syncCobro: Awaited<
        ReturnType<typeof sincronizarBecaCobroTrasCambioAdmin>
      > | null = null;
      if (yaActivadaCobro) {
        syncCobro = await sincronizarBecaCobroTrasCambioAdmin({
          db: db.database,
          alumnoId: Number(sol.alumno_id),
          alumnoRef: alumno?.alumno_ref,
          patch: parsedBeca.data,
        });
        if (!syncCobro.ok) {
          return NextResponse.json({ error: syncCobro.error }, { status: 500 });
        }
      }

      detalleBecaCambio = {
        beca_id_anterior:
          sol.beca_deseada_id != null ? Number(sol.beca_deseada_id) : null,
        beca_id_nuevo: parsedBeca.data.beca_id,
        porcentaje_anterior:
          sol.beca_porcentaje_deseado != null
            ? Number(sol.beca_porcentaje_deseado)
            : null,
        porcentaje_nuevo: parsedBeca.data.beca_porcentaje,
        beca_autorizada: Boolean(sol.beca_autorizada),
        ya_activada_cobro: yaActivadaCobro,
        sync_cobro: syncCobro,
      };
      if (!esBecaPromedioMinimoCartaEditable(parsedBeca.data.beca_id)) {
        patch.promedio_minimo_carta = null;
      }
      accionesLog.push('solicitud.cambiar_beca');
    }

    if (body.promedio_minimo_carta !== undefined) {
      const becaIdEff = parsedBeca.ok
        ? parsedBeca.data.beca_id
        : sol.beca_deseada_id != null
          ? Number(sol.beca_deseada_id)
          : null;

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
      if (!accionesLog.includes('solicitud.cambiar_beca')) {
        accionesLog.push('solicitud.cambiar_beca');
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
            : sol.seguimiento_individualizado,
        clausula_seguimiento_texto:
          body.clausula_seguimiento_texto !== undefined
            ? body.clausula_seguimiento_texto
            : sol.clausula_seguimiento_texto,
      });
      if (!parsedSeg.ok) {
        return NextResponse.json({ error: parsedSeg.error }, { status: 400 });
      }
      patch.seguimiento_individualizado = parsedSeg.activo;
      patch.clausula_seguimiento_texto = parsedSeg.texto;
      accionesLog.push(
        parsedSeg.activo
          ? 'solicitud.seguimiento_individualizado'
          : 'solicitud.quitar_seguimiento_individualizado'
      );
    }

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
      if (body.beca_autorizada) {
        patch.beca_rechazada = false;
        patch.beca_rechazada_en = null;
      }
      accionesLog.push(
        body.beca_autorizada
          ? 'solicitud.autorizar'
          : 'solicitud.quitar_autorizacion'
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
        alumnoId: Number(sol.alumno_id),
        expedienteId: id,
        flujo: 'solicitud',
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
    if (
      body.beca_autorizada === true &&
      !sol.beca_autorizada &&
      alumno
    ) {
      emailAvisoFirma = await enviarAvisoBecaAutorizadaFirma({
        db: db.database,
        flujo: 'solicitud',
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

    let emailAvisoCambioBeca: Awaited<
      ReturnType<typeof enviarAvisoCambioBecaAutorizada>
    > | null = null;
    if (
      detalleBecaCambio &&
      huboCambioBecaAutorizada(
        detalleBecaCambio as Parameters<typeof huboCambioBecaAutorizada>[0]
      ) &&
      alumno
    ) {
      emailAvisoCambioBeca = await enviarAvisoCambioBecaAutorizada({
        db: db.database,
        flujo: 'solicitud',
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
        cambio: detalleBecaCambio as Parameters<
          typeof enviarAvisoCambioBecaAutorizada
        >[0]['cambio'],
        cicloLabel: getSchoolCycleLabel(getCurrentSchoolCycle()),
      });
      if (detalleBecaCambio) {
        detalleBecaCambio = {
          ...detalleBecaCambio,
          email_aviso_cambio: emailAvisoCambioBeca,
        };
      }
    }

    let updated: Record<string, unknown> | null = null;
    if (Object.keys(patch).length > 0) {
      const { data: upd, error: upErr } = await db.database
        .from('becas_solicitud')
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
        entidad: 'solicitud',
        entidad_id: id,
        alumno_id: alumno ? Number(alumno.alumno_id) : Number(sol.alumno_id),
        alumno_ref: alumno?.alumno_ref != null ? String(alumno.alumno_ref) : null,
        alumno_nombre: nombreAlumnoAuditoria(alumno),
        alumno_nivel: alumno?.alumno_nivel != null ? Number(alumno.alumno_nivel) : null,
        detalle:
          accion === 'solicitud.cambiar_beca'
            ? { cambio_beca: detalleBecaCambio }
            : { cambios: patch, resultado: updated },
        ...meta,
      });
    }

    return NextResponse.json({
      ok: true,
      solicitud: updated,
      beca: detalleBecaCambio
        ? {
            beca_id: detalleBecaCambio.beca_id_nuevo,
            beca_porcentaje: detalleBecaCambio.porcentaje_nuevo,
          }
        : undefined,
      email_aviso_firma: emailAvisoFirma,
      email_aviso_cambio_beca: emailAvisoCambioBeca,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al actualizar.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
