/**
 * 2026-07-17 - API GET/POST solicitud de beca (nuevo ingreso).
 * Gate: alumno_permiso_solicitud_beca=1 y sin beca activa del ciclo pasado.
 * Persistencia: alumno_detalles / alumno_familiar + becas_solicitud*.
 * PDF de formulario al guardar (ingresos solo en PDF, no en BD).
 * 2026-07-18 - SEP (gobierno) no se ofrece ni se acepta como beca deseada.
 * 2026-07-28 - Historial antiguo (antepasado) no bloquea solicitud nueva.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { forbidWrongAlumno, requireAcceso } from '@/lib/acceso-auth';
import { getCurrentSchoolCycle, getSchoolCycleLabel } from '@/lib/ciclo-escolar';
import { tieneBecaActivaCicloPasado } from '@/lib/beca-elegibilidad';
import { esBecaNoTramitable, esConceptoTramitable } from '@/lib/becas-excluidas';
import {
  conceptosParaSelectPadres,
  etiquetaBecaParaPadres,
} from '@/lib/becas-etiquetas';
import { buildSolicitudDocsContext } from '@/lib/solicitud-docs-context';
import { assertPortalAbierto } from '@/lib/portal-ventanas';
import { labelNivel } from '@/lib/email-renovacion';
import { buildSolicitudPdf } from '@/lib/pdf/solicitud';
import { buildSolicitudNuevaDataFromRows } from '@/lib/pdf/map-data';
import type {
  Familiar,
  Hermano,
  SolicitudPayload,
  SolicitudPrecarga,
} from '@/lib/types';

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

/** 2026-07-17 - familiar_vive en maestro es smallint 0/1 */
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

type GateOk = {
  ok: true;
  alumno: Record<string, unknown>;
  alumnoId: number;
  ciclo: number;
};

type GateFail = {
  ok: false;
  response: NextResponse;
};

/**
 * 2026-07-17 - Gate de acceso compartido GET/POST:
 * 1) alumno activo existe
 * 2) alumno_permiso_solicitud_beca = 1
 * 3) no tiene ninguna fila en alumno_beca
 */
async function assertSolicitudGate(
  admin: ReturnType<typeof getInsforgeAdmin>,
  alumnoRefOrId: { alumno_ref?: number; alumno_id?: number }
): Promise<GateOk | GateFail> {
  const ciclo = getCurrentSchoolCycle();

  let alumnoQuery = admin.database.from('alumno').select('*');
  if (alumnoRefOrId.alumno_id != null) {
    alumnoQuery = alumnoQuery.eq('alumno_id', alumnoRefOrId.alumno_id);
  } else if (alumnoRefOrId.alumno_ref != null) {
    alumnoQuery = alumnoQuery.eq('alumno_ref', alumnoRefOrId.alumno_ref);
  } else {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Falta identificador de alumno.' },
        { status: 400 }
      ),
    };
  }

  const { data: alumno, error: alumnoErr } = await alumnoQuery
    .neq('alumno_status', 0)
    .maybeSingle();

  if (alumnoErr) {
    return {
      ok: false,
      response: NextResponse.json({ error: alumnoErr.message }, { status: 500 }),
    };
  }
  if (!alumno) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'No se encontró alumno activo con ese número de control.' },
        { status: 404 }
      ),
    };
  }

  const alumnoId = Number(alumno.alumno_id);

  // 2026-07-17 - Reemplazo de los 63 códigos hardcodeados del legacy
  if (Number(alumno.alumno_permiso_solicitud_beca) !== 1) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            'Este alumno no está autorizado para ingresar al portal de solicitud de beca. Contacte a coordinación.',
          codigo: 'NO_AUTORIZADO',
          ciclo_escolar: ciclo,
          ciclo_label: getSchoolCycleLabel(ciclo),
        },
        { status: 403 }
      ),
    };
  }

  // Solo beca activa del ciclo pasado → Renovación; antepasado = solicitud nueva.
  const becaCicloPasado = await tieneBecaActivaCicloPasado(admin.database, alumnoId);
  if (!becaCicloPasado.ok) {
    return {
      ok: false,
      response: NextResponse.json({ error: becaCicloPasado.error }, { status: 500 }),
    };
  }
  if (becaCicloPasado.tiene) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            'Este alumno tuvo beca el ciclo pasado. El portal de solicitud nueva no aplica; use Renovación.',
          codigo: 'YA_TIENE_BECA',
          ciclo_escolar: ciclo,
          ciclo_label: getSchoolCycleLabel(ciclo),
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, alumno, alumnoId, ciclo };
}

export async function GET(request: NextRequest) {
  try {
    const cerrado = assertPortalAbierto('solicitud');
    if (cerrado) {
      return NextResponse.json(cerrado, { status: 403 });
    }

    const alumnoRefRaw = (request.nextUrl.searchParams.get('alumno_ref') || '').trim();
    if (!alumnoRefRaw) {
      return NextResponse.json(
        { error: 'Falta el parámetro alumno_ref en la URL.' },
        { status: 400 }
      );
    }

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
    const gate = await assertSolicitudGate(admin, { alumno_ref: alumnoRef });
    if (!gate.ok) return gate.response;

    const { alumno, alumnoId, ciclo } = gate;

    const [
      { data: detalle },
      { data: familiares },
      { data: solicitud },
      { data: conceptos },
    ] = await Promise.all([
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
        .from('becas_solicitud')
        .select('*')
        .eq('alumno_id', alumnoId)
        .eq('ciclo_escolar', ciclo)
        .maybeSingle(),
      admin.database
        .from('becas_concepto_beca')
        .select('beca_id, beca_clase')
        .order('beca_id', { ascending: true }),
    ]);

    let hermanos: Hermano[] = [];
    let documentos: SolicitudPrecarga['documentos'] = [];

    if (solicitud?.id) {
      const [{ data: hermanosData }, { data: docsData }] = await Promise.all([
        admin.database
          .from('becas_solicitud_hermano')
          .select('*')
          .eq('solicitud_id', solicitud.id)
          .order('orden', { ascending: true }),
        admin.database
          .from('becas_solicitud_documento')
          .select('*')
          .eq('solicitud_id', solicitud.id),
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
        revision_estado: d.revision_estado || 'pendiente',
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

    let becaClaseSolicitud: string | null = null;
    if (solicitud?.beca_deseada_id != null) {
      const concepto = (conceptos || []).find(
        (c) => Number(c.beca_id) === Number(solicitud.beca_deseada_id)
      );
      becaClaseSolicitud = concepto?.beca_clase
        ? String(concepto.beca_clase)
        : null;
    }

    const docsCtx = await buildSolicitudDocsContext({
      alumno: {
        alumno_id: alumnoId,
        alumno_ref:
          alumno.alumno_ref != null ? Number(alumno.alumno_ref) : alumnoId,
        alumno_nivel:
          alumno.alumno_nivel != null ? Number(alumno.alumno_nivel) : null,
        alumno_grado:
          alumno.alumno_grado != null ? Number(alumno.alumno_grado) : null,
      },
      solicitud,
      becaClase: becaClaseSolicitud,
    });

    const tiposRequeridos = docsCtx.tipos;
    const tiposSubidos = new Set(documentos.map((d) => d.tipo));
    const faltaRequerido = tiposRequeridos.some((t) => !tiposSubidos.has(t));
    const docsPorCorregir =
      documentos.some((d) => d.revision_estado === 'incorrecto') ||
      (Boolean(solicitud?.enviado) && faltaRequerido);

    const payload: SolicitudPrecarga = {
      ciclo_escolar: ciclo,
      ciclo_label: getSchoolCycleLabel(ciclo),
      alumno: {
        id: alumnoId,
        alumno_ref: String(alumno.alumno_ref),
        nombre_completo: `${alumno.alumno_app || ''} ${alumno.alumno_apm || ''} ${alumno.alumno_nombre || ''}`.trim(),
        alumno_app: String(alumno.alumno_app || ''),
        alumno_apm: String(alumno.alumno_apm || ''),
        alumno_nombre: String(alumno.alumno_nombre || ''),
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
      conceptos: conceptosParaSelectPadres(
        (conceptos || [])
          .map((c) => ({
            beca_id: Number(c.beca_id),
            beca_clase: String(c.beca_clase),
          }))
          .filter(esConceptoTramitable),
        solicitud?.beca_deseada_id != null
          ? Number(solicitud.beca_deseada_id)
          : null
      ),
      mama: mapFamiliar(mamaRow, 1),
      papa: mapFamiliar(papaRow, 2),
      solicitud: solicitud
        ? {
            id: solicitud.id,
            beca_deseada_id:
              solicitud.beca_deseada_id != null
                ? Number(solicitud.beca_deseada_id)
                : null,
            beca_porcentaje_deseado:
              solicitud.beca_porcentaje_deseado != null
                ? Number(solicitud.beca_porcentaje_deseado)
                : null,
            tiene_otra_beca: Boolean(solicitud.tiene_otra_beca),
            otra_beca_sep: false,
            otra_beca_pemex: Boolean(solicitud.otra_beca_pemex),
            otra_beca_empresarial: Boolean(solicitud.otra_beca_empresarial),
            otra_beca_otro: Boolean(solicitud.otra_beca_otro),
            aporta_gastos:
              solicitud.aporta_gastos === null || solicitud.aporta_gastos === undefined
                ? null
                : Boolean(solicitud.aporta_gastos),
            parentesco_aportante: solicitud.parentesco_aportante || null,
            vivienda_tipo: solicitud.vivienda_tipo || null,
            motivo: solicitud.motivo || null,
            enviado: Boolean(solicitud.enviado),
            enviado_en: solicitud.enviado_en || null,
            sin_boleta_sep: Boolean(solicitud.sin_boleta_sep),
          }
        : null,
      hermanos,
      documentos,
      ya_registrado: Boolean(solicitud?.enviado),
      docs_por_corregir: docsPorCorregir,
      sin_boleta_sep: docsCtx.sin_boleta_sep,
      alumno_reinscrito: docsCtx.alumno_reinscrito,
      exento_boleta_sep: docsCtx.exento_boleta_sep,
      es_maternal_kinder: docsCtx.es_maternal_kinder,
      promedio: docsCtx.promedio,
      tipos_documentos_requeridos: tiposRequeridos,
    };

    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const cerrado = assertPortalAbierto('solicitud');
    if (cerrado) {
      return NextResponse.json(cerrado, { status: 403 });
    }

    const body = (await request.json()) as SolicitudPayload;
    const alumnoId = Number(body?.alumno_id);
    if (!Number.isFinite(alumnoId) || alumnoId <= 0) {
      return NextResponse.json({ error: 'Falta alumno_id válido.' }, { status: 400 });
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
    if (!body.beca_deseada_id) {
      return NextResponse.json(
        { error: 'Debe seleccionar el tipo de beca deseada.' },
        { status: 400 }
      );
    }

    const admin = getInsforgeAdmin();
    const gate = await assertSolicitudGate(admin, { alumno_id: alumnoId });
    if (!gate.ok) return gate.response;

    const { ciclo } = gate;

    // 2026-07-17 - No reeditar si ya envió
    const { data: existente } = await admin.database
      .from('becas_solicitud')
      .select('id, enviado')
      .eq('alumno_id', alumnoId)
      .eq('ciclo_escolar', ciclo)
      .maybeSingle();

    if (existente?.enviado) {
      return NextResponse.json(
        {
          error:
            'Este alumno ya envió su solicitud de beca. Solo puede consultar el acuse.',
          ya_registrado: true,
          solicitud_id: existente.id,
        },
        { status: 409 }
      );
    }

    // 2026-07-18 - No tramitar beca SEP (gobierno)
    if (esBecaNoTramitable(Number(body.beca_deseada_id))) {
      return NextResponse.json(
        {
          error:
            'Este tipo de beca no se tramita en el Portal de Becas del Instituto.',
          codigo: 'BECA_NO_TRAMITABLE',
        },
        { status: 400 }
      );
    }

    // Upsert domicilio en maestro
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

    // Upsert familiares (ingresos solo viajan en body; no hay columna en maestro)
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

    const solicitudRow = {
      alumno_id: alumnoId,
      ciclo_escolar: ciclo,
      beca_deseada_id: body.beca_deseada_id,
      beca_porcentaje_deseado: body.beca_porcentaje_deseado,
      tiene_otra_beca: Boolean(body.tiene_otra_beca),
      otra_beca_sep: false,
      otra_beca_pemex: Boolean(body.otra_beca_pemex),
      otra_beca_empresarial: Boolean(body.otra_beca_empresarial),
      otra_beca_otro: Boolean(body.otra_beca_otro),
      aporta_gastos: body.aporta_gastos,
      parentesco_aportante: body.parentesco_aportante || null,
      vivienda_tipo: body.vivienda_tipo || null,
      motivo: body.motivo.trim(),
    };

    let solicitudId: string;
    if (existente?.id) {
      const { data: updated, error } = await admin.database
        .from('becas_solicitud')
        .update(solicitudRow)
        .eq('id', existente.id)
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      solicitudId = updated.id;
    } else {
      const { data: inserted, error } = await admin.database
        .from('becas_solicitud')
        .insert([solicitudRow])
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      solicitudId = inserted.id;
    }

    await admin.database
      .from('becas_solicitud_hermano')
      .delete()
      .eq('solicitud_id', solicitudId);

    const hermanosValidos = (body.hermanos || []).filter(
      (h) => h.nombre && h.nombre.trim().length > 0
    );
    if (hermanosValidos.length > 0) {
      await admin.database.from('becas_solicitud_hermano').insert(
        hermanosValidos.map((h) => ({
          solicitud_id: solicitudId,
          orden: h.orden,
          nombre: h.nombre.trim(),
          edad: h.edad,
          institucion: h.institucion || null,
          colegiatura_mensual: h.colegiatura_mensual,
        }))
      );
    }

    // 2026-07-17 - PDF de formulario (ingresos del body; no persistidos)
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

    const { data: detallePdf } = await admin.database
      .from('alumno_detalles')
      .select('*')
      .eq('alumno_id', alumnoId)
      .maybeSingle();

    let becaClase = 'Sin beca';
    let becaPorcentaje = Number(body.beca_porcentaje_deseado) || 0;
    let promedioRequerido = '—';
    if (body.beca_deseada_id) {
      const { data: concepto } = await admin.database
        .from('becas_concepto_beca')
        .select('beca_clase, beca_promedio_requerido')
        .eq('beca_id', Number(body.beca_deseada_id))
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

    const solicitudData = buildSolicitudNuevaDataFromRows({
      alumno: alumnoPdf as Record<string, unknown>,
      detalle:
        (detallePdf as Record<string, unknown>) ||
        (body.detalle as unknown as Record<string, unknown>) ||
        null,
      mama: mamaForPdf as Record<string, unknown> | null,
      papa: papaForPdf as Record<string, unknown> | null,
      solicitud: {
        tiene_otra_beca: body.tiene_otra_beca,
        otra_beca_sep: false,
        otra_beca_pemex: body.otra_beca_pemex,
        otra_beca_empresarial: body.otra_beca_empresarial,
        otra_beca_otro: body.otra_beca_otro,
        vivienda_tipo: body.vivienda_tipo,
        motivo: body.motivo.trim(),
      },
      hermanos: hermanosValidos as unknown as Record<string, unknown>[],
      becaClase,
      becaPorcentaje,
      promedioRequerido,
      cicloLabel: getSchoolCycleLabel(ciclo),
      nivelLabel: labelNivel(
        alumnoPdf.alumno_nivel != null ? Number(alumnoPdf.alumno_nivel) : null
      ),
      ingresoPadre: body.ingreso_mensual_padre,
      ingresoMadre: body.ingreso_mensual_madre,
    });

    const solicitudBuffer = await buildSolicitudPdf(solicitudData, {
      title: 'Solicitud de Beca',
    });
    const solicitudKey = `solicitud/${alumnoId}/${solicitudId}/solicitud-${Date.now()}.pdf`;
    const solicitudFile = new File(
      [new Uint8Array(solicitudBuffer)],
      'solicitud-beca.pdf',
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
      .from('becas_solicitud')
      .update({
        pdf_solicitud_key: uploadSolicitud?.key || solicitudKey,
        pdf_solicitud_url: uploadSolicitud?.url || null,
      })
      .eq('id', solicitudId);

    return NextResponse.json({
      success: true,
      solicitud_id: solicitudId,
      ciclo_escolar: ciclo,
      message: 'Solicitud guardada correctamente.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
