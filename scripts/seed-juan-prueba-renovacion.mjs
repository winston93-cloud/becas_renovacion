/**
 * Crea/actualiza JUAN PRUEBA PRUEBA (29901) secundaria, activo, con beca
 * del ciclo origen lista para renovar. Sin renovación enviada (para probar el flujo).
 *
 * Uso: node --env-file=.env.local scripts/seed-juan-prueba-renovacion.mjs
 */
import { createAdminClient } from '@insforge/sdk';

const REF_JUAN = 29901;
const CLAVE = 'admin123';
const EMAIL = 'isc.escobedo@gmail.com';

function cicloCalendario() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const startYear =
    month > 7 || (month === 7 && day >= 10) ? year : year - 1;
  return startYear - 2003;
}

function cicloOrigen() {
  return cicloCalendario() - 1;
}

async function main() {
  const baseUrl = process.env.INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) throw new Error('Faltan INSFORGE_URL / INSFORGE_API_KEY');

  const admin = createAdminClient({ baseUrl, apiKey });
  const db = admin.database;
  const origen = cicloOrigen();
  const calendario = cicloCalendario();
  const ahora = new Date().toISOString();

  // Limpiar renovaciones/solicitudes previas de Juan (para empezar limpio)
  const { data: existente } = await db
    .from('alumno')
    .select('alumno_id, alumno_ref')
    .eq('alumno_ref', REF_JUAN)
    .maybeSingle();

  if (existente?.alumno_id) {
    const jid = Number(existente.alumno_id);
    const { data: rens } = await db
      .from('becas_renovacion')
      .select('id')
      .eq('alumno_id', jid);
    for (const r of rens || []) {
      await db.from('becas_documento').delete().eq('renovacion_id', r.id);
      await db.from('becas_hermano').delete().eq('renovacion_id', r.id);
      await db.from('becas_renovacion').delete().eq('id', r.id);
    }
    const { data: sols } = await db
      .from('becas_solicitud')
      .select('id')
      .eq('alumno_id', jid);
    for (const s of sols || []) {
      await db.from('becas_solicitud_documento').delete().eq('solicitud_id', s.id);
      await db.from('becas_solicitud').delete().eq('id', s.id);
    }
    console.log('Limpieza renovación/solicitud previa de Juan ok');
  }

  let { data: juan } = await db
    .from('alumno')
    .select('alumno_id, alumno_ref')
    .eq('alumno_ref', REF_JUAN)
    .maybeSingle();

  if (!juan) {
    const { data: maxRow } = await db
      .from('alumno')
      .select('alumno_id')
      .order('alumno_id', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextId = Number(maxRow?.alumno_id || 9000) + 100;
    const { data: created, error } = await db
      .from('alumno')
      .insert([
        {
          alumno_id: nextId,
          alumno_ref: REF_JUAN,
          alumno_app: 'PRUEBA',
          alumno_apm: 'PRUEBA',
          alumno_nombre: 'JUAN',
          alumno_nivel: 4,
          alumno_grado: 1,
          alumno_grupo: 1,
          alumno_status: 1,
          alumno_nuevo_ingreso: 0,
          alumno_ciclo_escolar: calendario,
          alumno_boleta: 0,
          mes: 0,
          secret_key: `prueba-juan-${Date.now()}`,
          motivo: 'PRUEBA',
          responsable: 'SISTEMAS',
          digito: 0,
          alumno_permiso_solicitud_beca: 0,
          alumno_solicitud_acceso_enviada: 0,
        },
      ])
      .select('alumno_id, alumno_ref')
      .single();
    if (error) throw new Error(`crear alumno: ${error.message}`);
    juan = created;
    console.log('Creado JUAN', juan);
  } else {
    const { error } = await db
      .from('alumno')
      .update({
        alumno_app: 'PRUEBA',
        alumno_apm: 'PRUEBA',
        alumno_nombre: 'JUAN',
        alumno_nivel: 4,
        alumno_grado: 1,
        alumno_grupo: 1,
        alumno_status: 1,
        alumno_nuevo_ingreso: 0,
        alumno_ciclo_escolar: calendario,
        alumno_permiso_solicitud_beca: 0,
        alumno_solicitud_acceso_enviada: 0,
      })
      .eq('alumno_id', juan.alumno_id);
    if (error) throw new Error(`update alumno: ${error.message}`);
    console.log('Actualizado JUAN existente', juan);
  }

  const aid = Number(juan.alumno_id);

  const { data: det } = await db
    .from('alumno_detalles')
    .select('detalle_id, alumno_id')
    .eq('alumno_id', aid)
    .maybeSingle();
  if (det?.detalle_id) {
    const { error } = await db
      .from('alumno_detalles')
      .update({ alumno_clave: CLAVE })
      .eq('detalle_id', det.detalle_id);
    if (error) throw new Error(`detalles update: ${error.message}`);
  } else {
    const { data: maxDet } = await db
      .from('alumno_detalles')
      .select('detalle_id')
      .order('detalle_id', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextDet = Number(maxDet?.detalle_id || 10000) + 50;
    const { error } = await db.from('alumno_detalles').insert([
      { detalle_id: nextDet, alumno_id: aid, alumno_clave: CLAVE },
    ]);
    if (error) throw new Error(`detalles insert: ${error.message}`);
  }

  for (const tutor_id of [1, 2]) {
    const { data: fam } = await db
      .from('alumno_familiar')
      .select('familiar_id')
      .eq('alumno_id', aid)
      .eq('tutor_id', tutor_id)
      .maybeSingle();
    const row = {
      alumno_id: aid,
      tutor_id,
      familiar_app: tutor_id === 1 ? 'MAMA' : 'PAPA',
      familiar_apm: 'PRUEBA',
      familiar_nombre: 'PRUEBA',
      familiar_email: EMAIL,
      familiar_recibir_email: 1,
      familiar_vive: 1,
      familiar_factura: 0,
      familiar_actualizacion: ahora,
    };
    if (fam?.familiar_id) {
      await db.from('alumno_familiar').update(row).eq('familiar_id', fam.familiar_id);
    } else {
      let lastErr = null;
      for (let attempt = 0; attempt < 8; attempt++) {
        const { error } = await db.from('alumno_familiar').insert([row]);
        if (!error) {
          lastErr = null;
          break;
        }
        lastErr = error;
        const m = String(error.message || '').match(
          /null value in column "([^"]+)"/
        );
        if (!m) break;
        const col = m[1];
        if (col.endsWith('_en') || col.includes('fecha') || col.includes('registro')) {
          row[col] = ahora;
        } else if (col.includes('email')) {
          row[col] = EMAIL;
        } else {
          row[col] = 0;
        }
      }
      if (lastErr) throw new Error(`familiar ${tutor_id}: ${lastErr.message}`);
    }
  }

  const { data: becaExist } = await db
    .from('alumno_beca')
    .select('alumno_beca_id')
    .eq('alumno_id', aid)
    .eq('beca_ciclo_escolar', origen)
    .maybeSingle();
  const becaRow = {
    alumno_id: aid,
    alumno_ref: REF_JUAN,
    beca_id: 9,
    beca_porcentaje: 25,
    beca_estatus: 1,
    beca_ciclo_escolar: origen,
    beca_registro: ahora,
    beca_actualizacion: ahora,
    beca_p: '0',
  };
  if (becaExist?.alumno_beca_id) {
    const { error } = await db
      .from('alumno_beca')
      .update(becaRow)
      .eq('alumno_beca_id', becaExist.alumno_beca_id);
    if (error) throw new Error(`alumno_beca update: ${error.message}`);
  } else {
    const { error } = await db.from('alumno_beca').insert([becaRow]);
    if (error) throw new Error(`alumno_beca insert: ${error.message}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        alumno: 'JUAN PRUEBA PRUEBA',
        alumno_ref: REF_JUAN,
        clave: CLAVE,
        nivel: 'Secundaria 1°',
        ciclo_calendario: calendario,
        ciclo_beca_origen: origen,
        url: 'https://becas-renovacion.vercel.app/',
        flujo: 'Renovación (sin expediente previo; para subir documentos tú)',
        docs_que_pide: [
          'Comprobante(s) de ingresos de un mes',
          'Comprobante de domicilio',
          'Boleta SEP del ciclo escolar',
          'Comprobante(s) de pago de inscripción completa',
        ],
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
