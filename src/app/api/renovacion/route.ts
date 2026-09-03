/**
 * 2026-07-16 - API GET/POST renovación usando tablas maestro public:
 * alumno, alumno_detalles, alumno_familiar, alumno_beca.
 * Renovación propia: becas_renovacion / hermano / documento.
 * 2026-07-16 - Ingresos de padres no se persisten; solo van al PDF de solicitud.
 * 2026-07-18 - Beca SEP (gobierno) no se renueva en este portal.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import {
  getCicloBecaARenovar,
  getCurrentSchoolCycle,
  getSchoolCycleLabel,
} from '@/lib/ciclo-escolar';
import { requireAcceso, forbidWrongAlumno } from '@/lib/acceso-auth';
import { esBecaNoTramitable } from '@/lib/becas-excluidas';
import { etiquetaBecaParaPadres } from '@/lib/becas-etiquetas';
import { normalizarRevisionEstado } from '@/lib/doc-revision';
import {
  assertPortalRenovacionOExcepcionCompleta,
  assertPortalRenovacionOExcepcionDocs,
  renovacionExentaCompletaPostCierre,
  renovacionExentaPorDocsIncorrectos,
} from '@/lib/portal-renovacion-excepcion';
import { labelNivel } from '@/lib/email-renovacion';
import { buildSolicitudPdf } from '@/lib/pdf/solicitud';
import { buildSolicitudDataFromRows } from '@/lib/pdf/map-data';
import type { Familiar, Hermano, RenovacionPayload, RenovacionPrecarga } from '@/lib/types';
import {
  MES_APLICA_DEFAULT,
  MES_APLICA_POST_CIERRE,
} from '@/lib/beca-aplica-desde-mes';

function emptyFamiliar(tutor_id: 1 | 2): Familiar {
  return {
    tutor_id,
    familiar_app: '',
    familiar_apm: '',
    familiar_nombre: '',
    familiar_vive: null,
    familiar_escolaridad: null,
    familiar_empresa_nombre: null,
    familiar_empresa_puesto: null,
    familiar_empresa_tel: null,
    familiar_tel: null,
    familiar_cel: null,
    familiar_email: null,
  };
}

function splitNombreCompleto(nombre: string | null | undefined) {
  const parts = (nombre || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { app: '', apm: '', nombre: '' };
  if (parts.length === 1) return { app: parts[0], apm: '', nombre: '' };
  if (parts.length === 2) return { app: parts[0], apm: '', nombre: parts[1] };
  return {
    app: parts[0],
    apm: parts[1],
    nombre: parts.slice(2).join(' '),
  };
}

/** 2026-07-16 - familiar_vive en maestro es smallint 0/1 */
function normalizeVive(v: unknown): boolean | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return v;
  const n = Number(v);
  if (n === 1) return true;
  if (n === 0) return false;
  return null;
}

function viveToSmallint(v: boolean | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  return v ? 1 : 0;
}

export async function GET(request: NextRequest) {
  try {
    const alumnoRefRaw = (request.nextUrl.searchParams.get('alumno_ref') || '').trim();
    if (!alumnoRefRaw) {
      return NextResponse.json(
        { error: 'Falta el parámetro alumno_ref en la URL.' },
        { status: 400 }
      );
    }

    // 2026-07-16 - alumno_ref en InsForge es integer
    const alumnoRef = Number(alumnoRefRaw);
    if (!Number.isFinite(alumnoRef) || alumnoRef <= 0) {
      return NextResponse.json(
        { error: 'alumno_ref debe ser un número de control válido.' },
        { status: 400 }
      );
    }

    // 2026-07-22 - Exige sesión (No. Control + contraseña)
    const auth = requireAcceso(request, alumnoRef);
    if (!auth.ok) return auth.response;

    const admin = getInsforgeAdmin();
    // 2026-07-16 - Renovar becas del ciclo anterior (ej. 22), no del calendario recién iniciado (23)
    const ciclo = getCicloBecaARenovar();
    const cicloCalendario = getCurrentSchoolCycle();

    const { data: alumno, error: alumnoErr } = await admin.database
      .from('alumno')
      .select('*')
      .eq('alumno_ref', alumnoRef)
      .neq('alumno_status', 0)
      .maybeSingle();

    if (alumnoErr) {
      return NextResponse.json({ error: alumnoErr.message }, { status: 500 });
    }
    if (!alumno) {
      return NextResponse.json(
        { error: `No se encontró alumno activo con No. Control ${alumnoRef}.` },
        { status: 404 }
      );
    }

    const alumnoId = Number(alumno.alumno_id);

    const cerrado = await assertPortalRenovacionOExcepcionDocs(admin, alumnoId);
    if (cerrado) {
      return NextResponse.json(cerrado, { status: 403 });
    }

    const accesoCorreccionPostCierre = await renovacionExentaPorDocsIncorrectos(
      admin,
      alumnoId
    );
    const accesoRenovacionCompletaPostCierre =
      await renovacionExentaCompletaPostCierre(admin, alumnoId);

    // 2026-07-23 - Gate = legacy PHP: beca_estatus = 1 en ciclo a renovar (calendario − 1)
    const { data: becaRow, error: becaErr } = await admin.database
      .from('alumno_beca')
      .select('*')
      .eq('alumno_id', alumnoId)
      .eq('beca_ciclo_escolar', ciclo)
      .eq('beca_estatus', 1)
      .maybeSingle();

    if (becaErr) {
      return NextResponse.json({ error: becaErr.message }, { status: 500 });
    }
    if (!becaRow) {
      return NextResponse.json(
        {
          error:
            'No encontramos una beca activa del ciclo a renovar para este número de control.',
          codigo: 'SIN_BECA_RENOVABLE',
          ciclo_escolar: ciclo,
          ciclo_calendario: cicloCalendario,
          // Label visible a padres = ciclo calendario nuevo (2026-2027), no el origen 22
          ciclo_label: getSchoolCycleLabel(cicloCalendario),
        },
        { status: 403 }
      );
    }

    const becaId = Number(becaRow.beca_id);

    // 2026-07-18 - SEP es federal; no se renueva en este portal
    if (esBecaNoTramitable(becaId)) {
      return NextResponse.json(
        {
          error:
            'La beca asociada a este alumno no se renueva en el Portal de Becas del Instituto. Acuda al área de becas para orientación.',
          codigo: 'BECA_NO_TRAMITABLE',
        },
        { status: 403 }
      );
    }

    const { data: concepto } = await admin.database
      .from('becas_concepto_beca')
      .select('beca_clase, beca_promedio_requerido')
      .eq('beca_id', becaId)
      .maybeSingle();

    const [{ data: detalle }, { data: familiares }, { data: renovacion }] =
      await Promise.all([
        admin.database
          .from('alumno_detalles')
          .select('*')
          .eq('alumno_id', alumnoId)
          .maybeSingle(),
        admin.database
          .from('alumno_familiar')
          .select('*')
          .eq('alumno_id', alumnoId),
        admin.database
          .from('becas_renovacion')
          .select('*')
          .eq('alumno_id', alumnoId)
          .eq('ciclo_escolar', ciclo)
          .maybeSingle(),
      ]);

    let hermanos: Hermano[] = [];
    let documentos: RenovacionPrecarga['documentos'] = [];

    if (renovacion?.id) {
      const [{ data: hermanosData }, { data: docsData }] = await Promise.all([
        admin.database
          .from('becas_hermano')
          .select('*')
          .eq('renovacion_id', renovacion.id)
          .order('orden', { ascending: true }),
        admin.database
          .from('becas_documento')
          .select('*')
          .eq('renovacion_id', renovacion.id),
      ]);

      hermanos = (hermanosData || []).map((h) => ({
        orden: h.orden,
        nombre: h.nombre || '',
        edad: h.edad,
        institucion: h.institucion || '',
        colegiatura_mensual: h.colegiatura_mensual,
      }));

      documentos = (docsData || []).map((d) => ({
        id: d.id,
        tipo: d.tipo,
        storage_key: d.storage_key,
        storage_url: d.storage_url,
        nombre_original: d.nombre_original,
        subido_en: d.subido_en,
        revision_estado: normalizarRevisionEstado(d.revision_estado),
        revision_nota: d.revision_nota || null,
      }));
    }

    const mamaRow = (familiares || []).find((f) => Number(f.tutor_id) === 1) || null;
    const papaRow = (familiares || []).find((f) => Number(f.tutor_id) === 2) || null;

    const mapFamiliar = (
      row: Record<string, unknown> | null,
      tutor_id: 1 | 2
    ): Familiar => {
      if (!row) return emptyFamiliar(tutor_id);
      return {
        id: row.familiar_id != null ? String(row.familiar_id) : undefined,
        tutor_id,
        familiar_app: String(row.familiar_app || ''),
        familiar_apm: String(row.familiar_apm || ''),
        familiar_nombre: String(row.familiar_nombre || ''),
        familiar_vive: normalizeVive(row.familiar_vive),
        familiar_escolaridad: (row.familiar_escolaridad as string) || null,
        familiar_empresa_nombre: (row.familiar_empresa_nombre as string) || null,
        familiar_empresa_puesto: (row.familiar_empresa_puesto as string) || null,
        familiar_empresa_tel: (row.familiar_empresa_tel as string) || null,
        familiar_tel: (row.familiar_tel as string) || null,
        familiar_cel: (row.familiar_cel as string) || null,
        familiar_email: (row.familiar_email as string) || null,
      };
    };

    const docsPorCorregir = documentos.some(
      (d) => d.revision_estado === 'incorrecto'
    );

    const payload: RenovacionPrecarga = {
      ciclo_escolar: ciclo,
      ciclo_calendario: cicloCalendario,
      // 2026-07-16 - Texto para padres: ciclo nuevo (2026-2027); la beca validada es ciclo_escolar (22)
      ciclo_label: getSchoolCycleLabel(cicloCalendario),
      alumno: {
        id: alumnoId,
        alumno_ref: String(alumno.alumno_ref),
        nombre_completo: `${alumno.alumno_app || ''} ${alumno.alumno_apm || ''} ${alumno.alumno_nombre || ''}`.trim(),
        alumno_app: alumno.alumno_app || '',
        alumno_apm: alumno.alumno_apm || '',
        alumno_nombre: alumno.alumno_nombre || '',
        alumno_nivel: alumno.alumno_nivel != null ? Number(alumno.alumno_nivel) : null,
        alumno_grado: alumno.alumno_grado != null ? Number(alumno.alumno_grado) : null,
        alumno_grupo:
          alumno.alumno_grupo != null ? String(alumno.alumno_grupo) : null,
      },
      detalle: detalle
        ? {
            alumno_calle: detalle.alumno_calle || null,
            alumno_numero: detalle.alumno_numero || null,
            alumno_colonia: detalle.alumno_colonia || null,
            alumno_cp:
              detalle.alumno_cp != null ? String(detalle.alumno_cp) : null,
          }
        : null,
      beca: {
        beca_id: becaId,
        beca_clase: etiquetaBecaParaPadres(
          concepto?.beca_clase ? String(concepto.beca_clase) : 'Sin beca'
        ),
        beca_porcentaje: Number(becaRow.beca_porcentaje) || 0,
        beca_promedio_requerido: Number(concepto?.beca_promedio_requerido) || 0,
      },
      mama: mapFamiliar(mamaRow, 1),
      papa: mapFamiliar(papaRow, 2),
      renovacion: renovacion
        ? {
            id: renovacion.id,
            // 2026-07-16 - Política: nunca devolver ingresos almacenados
            ingreso_mensual_padre: null,
            ingreso_mensual_madre: null,
            motivo: renovacion.motivo,
            casa_tipo: renovacion.casa_tipo,
            otra_beca: renovacion.otra_beca,
            otra_beca_porcentaje: renovacion.otra_beca_porcentaje,
            observaciones: renovacion.observaciones,
            // 2026-07-16 - Flag de registro ya finalizado
            correo_enviado: Boolean(renovacion.correo_enviado),
            correo_enviado_en: renovacion.correo_enviado_en || null,
          }
        : null,
      hermanos,
      documentos,
      // 2026-07-16 - Si ya finalizó, el frontend va al comprobante (o a correcciones)
      ya_registrado: Boolean(renovacion?.correo_enviado),
      docs_por_corregir: docsPorCorregir,
      acceso_correccion_post_cierre: accesoCorreccionPostCierre,
      acceso_renovacion_completa_post_cierre: accesoRenovacionCompletaPostCierre,
    };

    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RenovacionPayload;
    const alumnoId = Number(body?.alumno_id);
    if (!Number.isFinite(alumnoId) || alumnoId <= 0) {
      return NextResponse.json({ error: 'Falta alumno_id válido.' }, { status: 400 });
    }

    const admin = getInsforgeAdmin();
    const cerrado = await assertPortalRenovacionOExcepcionCompleta(admin, alumnoId);
    if (cerrado) {
      return NextResponse.json(cerrado, { status: 403 });
    }

    // 2026-07-22 - Exige sesión y que coincida el alumno
    const auth = requireAcceso(request);
    if (!auth.ok) return auth.response;
    const wrong = forbidWrongAlumno(auth.acceso, alumnoId);
    if (wrong) return wrong;
    if (!body.motivo || body.motivo.trim().length < 5) {
      return NextResponse.json(
        { error: 'El motivo de la solicitud es obligatorio (mínimo 5 caracteres).' },
        { status: 400 }
      );
    }
    if (body.motivo.length > 500) {
      return NextResponse.json(
        { error: 'El motivo no puede exceder 500 caracteres.' },
        { status: 400 }
      );
    }

    // 2026-07-16 - Guardar renovación contra el ciclo de beca a renovar (anterior)
    const ciclo = getCicloBecaARenovar();

    // 2026-07-16 - No permitir reeditar si ya finalizó el registro
    const { data: existente } = await admin.database
      .from('becas_renovacion')
      .select('id, correo_enviado')
      .eq('alumno_id', alumnoId)
      .eq('ciclo_escolar', ciclo)
      .maybeSingle();

    if (existente?.correo_enviado) {
      return NextResponse.json(
        {
          error:
            'Este alumno ya realizó su renovación de beca. Solo puede consultar el comprobante.',
          ya_registrado: true,
          renovacion_id: existente.id,
        },
        { status: 409 }
      );
    }

    // Actualizar domicilio en maestro alumno_detalles
    if (body.detalle) {
      const cpNum =
        body.detalle.alumno_cp !== '' && body.detalle.alumno_cp != null
          ? Number(body.detalle.alumno_cp)
          : null;

      const detallePatch = {
        alumno_calle: body.detalle.alumno_calle || null,
        alumno_numero: body.detalle.alumno_numero || null,
        alumno_colonia: body.detalle.alumno_colonia || null,
        alumno_cp: Number.isFinite(cpNum as number) ? cpNum : null,
        detalle_actualizacion: new Date().toISOString(),
      };

      const { data: existingDetalle } = await admin.database
        .from('alumno_detalles')
        .select('detalle_id')
        .eq('alumno_id', alumnoId)
        .maybeSingle();

      if (existingDetalle?.detalle_id) {
        await admin.database
          .from('alumno_detalles')
          .update(detallePatch)
          .eq('detalle_id', existingDetalle.detalle_id);
      } else {
        await admin.database.from('alumno_detalles').insert([
          {
            alumno_id: alumnoId,
            ...detallePatch,
          },
        ]);
      }
    }

    // Upsert familiares en maestro alumno_familiar
    for (const tutor of [
      { tutor_id: 1 as const, data: body.mama },
      { tutor_id: 2 as const, data: body.papa },
    ]) {
      if (!tutor.data) continue;
      const parsed = splitNombreCompleto(
        [
          tutor.data.familiar_app,
          tutor.data.familiar_apm,
          tutor.data.familiar_nombre,
        ]
          .filter(Boolean)
          .join(' ') || undefined
      );

      const row = {
        alumno_id: alumnoId,
        tutor_id: tutor.tutor_id,
        familiar_app: tutor.data.familiar_app || parsed.app,
        familiar_apm: tutor.data.familiar_apm || parsed.apm,
        familiar_nombre: tutor.data.familiar_nombre || parsed.nombre,
        familiar_vive: viveToSmallint(tutor.data.familiar_vive ?? null),
        familiar_escolaridad: tutor.data.familiar_escolaridad || null,
        familiar_empresa_nombre: tutor.data.familiar_empresa_nombre || null,
        familiar_empresa_puesto: tutor.data.familiar_empresa_puesto || null,
        familiar_empresa_tel: tutor.data.familiar_empresa_tel || null,
        familiar_tel: tutor.data.familiar_tel || null,
        familiar_cel: tutor.data.familiar_cel || null,
        familiar_email: tutor.data.familiar_email || null,
        familiar_actualizacion: new Date().toISOString(),
      };

      const { data: existingFam } = await admin.database
        .from('alumno_familiar')
        .select('familiar_id')
        .eq('alumno_id', alumnoId)
        .eq('tutor_id', tutor.tutor_id)
        .maybeSingle();

      if (existingFam?.familiar_id) {
        await admin.database
          .from('alumno_familiar')
          .update(row)
          .eq('familiar_id', existingFam.familiar_id);
      } else {
        await admin.database.from('alumno_familiar').insert([row]);
      }
    }

    // Upsert renovación (tabla propia)
    // 2026-07-16 - Ingresos siempre null en BD (política de privacidad)
    const esPostCierreCompleta = await renovacionExentaCompletaPostCierre(
      admin,
      alumnoId
    );
    const renovacionRow: Record<string, unknown> = {
      alumno_id: alumnoId,
      ciclo_escolar: ciclo,
      ingreso_mensual_padre: null,
      ingreso_mensual_madre: null,
      motivo: body.motivo.trim(),
      casa_tipo: body.casa_tipo || null,
      otra_beca: Boolean(body.otra_beca),
      otra_beca_porcentaje: body.otra_beca_porcentaje,
      observaciones: body.observaciones?.trim() || null,
      solicitud: true,
    };

    const { data: existingRen } = await admin.database
      .from('becas_renovacion')
      .select('id, beca_aplica_desde_mes')
      .eq('alumno_id', alumnoId)
      .eq('ciclo_escolar', ciclo)
      .maybeSingle();

    let renovacionId: string;
    if (existingRen?.id) {
      // No pisar un mes ya fijado por CE/admin; si viene null y es post-cierre → octubre.
      if (
        existingRen.beca_aplica_desde_mes == null &&
        esPostCierreCompleta
      ) {
        renovacionRow.beca_aplica_desde_mes = MES_APLICA_POST_CIERRE;
      }
      const { data: updated, error } = await admin.database
        .from('becas_renovacion')
        .update(renovacionRow)
        .eq('id', existingRen.id)
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      renovacionId = updated.id;
    } else {
      renovacionRow.beca_aplica_desde_mes = esPostCierreCompleta
        ? MES_APLICA_POST_CIERRE
        : MES_APLICA_DEFAULT;
      const { data: inserted, error } = await admin.database
        .from('becas_renovacion')
        .insert([renovacionRow])
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      renovacionId = inserted.id;
    }

    await admin.database.from('becas_hermano').delete().eq('renovacion_id', renovacionId);

    const hermanosValidos = (body.hermanos || []).filter(
      (h) => h.nombre && h.nombre.trim().length > 0
    );
    if (hermanosValidos.length > 0) {
      await admin.database.from('becas_hermano').insert(
        hermanosValidos.map((h) => ({
          renovacion_id: renovacionId,
          orden: h.orden,
          nombre: h.nombre.trim(),
          edad: h.edad,
          institucion: h.institucion || null,
          colegiatura_mensual: h.colegiatura_mensual,
        }))
      );
    }

    // 2026-07-16 - PDF de solicitud con ingresos del body (no persistidos)
    const { data: alumnoPdf } = await admin.database
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre, alumno_nivel, alumno_grado, alumno_grupo'
      )
      .eq('alumno_id', alumnoId)
      .maybeSingle();

    if (!alumnoPdf) {
      throw new Error('Alumno no encontrado al generar PDF de solicitud.');
    }

    const [{ data: becaRow }, { data: detallePdf }] = await Promise.all([
      admin.database
        .from('alumno_beca')
        .select('beca_id, beca_porcentaje')
        .eq('alumno_id', alumnoId)
        .eq('beca_ciclo_escolar', ciclo)
        .maybeSingle(),
      admin.database
        .from('alumno_detalles')
        .select('*')
        .eq('alumno_id', alumnoId)
        .maybeSingle(),
    ]);

    let becaClase = 'Sin beca';
    let becaPorcentaje = 0;
    let promedioRequerido = '—';
    if (becaRow) {
      becaPorcentaje = Number(becaRow.beca_porcentaje) || 0;
      const { data: concepto } = await admin.database
        .from('becas_concepto_beca')
        .select('beca_clase, beca_promedio_requerido')
        .eq('beca_id', Number(becaRow.beca_id))
        .maybeSingle();
      becaClase = etiquetaBecaParaPadres(
        concepto?.beca_clase ? String(concepto.beca_clase) : 'Sin beca'
      );
      promedioRequerido =
        concepto?.beca_promedio_requerido != null
          ? String(concepto.beca_promedio_requerido)
          : '—';
    }

    const mamaForPdf = body.mama
      ? {
          familiar_app: body.mama.familiar_app,
          familiar_apm: body.mama.familiar_apm,
          familiar_nombre: body.mama.familiar_nombre,
          familiar_vive: body.mama.familiar_vive,
          familiar_empresa_nombre: body.mama.familiar_empresa_nombre,
          familiar_empresa_puesto: body.mama.familiar_empresa_puesto,
          familiar_tel: body.mama.familiar_tel,
          familiar_cel: body.mama.familiar_cel,
          familiar_email: body.mama.familiar_email,
        }
      : null;
    const papaForPdf = body.papa
      ? {
          familiar_app: body.papa.familiar_app,
          familiar_apm: body.papa.familiar_apm,
          familiar_nombre: body.papa.familiar_nombre,
          familiar_vive: body.papa.familiar_vive,
          familiar_empresa_nombre: body.papa.familiar_empresa_nombre,
          familiar_empresa_puesto: body.papa.familiar_empresa_puesto,
          familiar_tel: body.papa.familiar_tel,
          familiar_cel: body.papa.familiar_cel,
          familiar_email: body.papa.familiar_email,
        }
      : null;

    const cicloCalendario = getCurrentSchoolCycle();
    const solicitudData = buildSolicitudDataFromRows({
      alumno: alumnoPdf as Record<string, unknown>,
      detalle: (detallePdf as Record<string, unknown>) ||
        (body.detalle as unknown as Record<string, unknown>) ||
        null,
      mama: mamaForPdf as Record<string, unknown> | null,
      papa: papaForPdf as Record<string, unknown> | null,
      renovacion: {
        otra_beca: body.otra_beca,
        otra_beca_porcentaje: body.otra_beca_porcentaje,
        casa_tipo: body.casa_tipo,
        motivo: body.motivo.trim(),
        observaciones: body.observaciones,
      },
      hermanos: hermanosValidos as unknown as Record<string, unknown>[],
      becaClase,
      becaPorcentaje,
      promedioRequerido,
      cicloLabel: getSchoolCycleLabel(cicloCalendario),
      nivelLabel: labelNivel(
        alumnoPdf.alumno_nivel != null ? Number(alumnoPdf.alumno_nivel) : null
      ),
      ingresoPadre: body.ingreso_mensual_padre,
      ingresoMadre: body.ingreso_mensual_madre,
    });

    const solicitudBuffer = await buildSolicitudPdf(solicitudData, {
      title: 'Renovación de Beca',
    });
    const solicitudKey = `${alumnoId}/${renovacionId}/solicitud-${Date.now()}.pdf`;
    const solicitudFile = new File(
      [new Uint8Array(solicitudBuffer)],
      'solicitud-renovacion.pdf',
      { type: 'application/pdf' }
    );

    const { data: uploadSolicitud, error: upSolErr } = await admin.storage
      .from('becas-documentos')
      .upload(solicitudKey, solicitudFile);

    if (upSolErr) {
      throw new Error(
        `No se pudo guardar el PDF de solicitud: ${upSolErr.message}`
      );
    }

    await admin.database
      .from('becas_renovacion')
      .update({
        pdf_solicitud_key: uploadSolicitud?.key || solicitudKey,
        pdf_solicitud_url: uploadSolicitud?.url || null,
      })
      .eq('id', renovacionId);

    return NextResponse.json({
      success: true,
      renovacion_id: renovacionId,
      ciclo_escolar: ciclo,
      message: 'Renovación guardada correctamente.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
