/**
 * 1) Elimina de forma definitiva todos los alumnos de prueba (JUAN/LUIS/RUBEN/ALAN… + refs 29901–29920).
 * 2) Da de alta ALAN PRUEBA PRUEBA (primaria) para solicitud nueva.
 *
 * Uso: node --env-file=.env.local scripts/purge-pruebas-y-seed-alan.mjs
 */
import { createAdminClient } from '@insforge/sdk';

const REF_ALAN = 29904;
const CLAVE = 'admin123';
const EMAIL = 'isc.escobedo@gmail.com';
const REFS_LEGACY = [29901, 29902, 29903, 29904, 29905, 29910, 29920];

function cicloCalendario() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const startYear =
    month > 7 || (month === 7 && day >= 10) ? year : year - 1;
  return startYear - 2003;
}

function esPruebaNombre(a) {
  const parts = [a.alumno_app, a.alumno_apm, a.alumno_nombre]
    .map((p) => (p != null ? String(p).trim().toUpperCase() : ''))
    .filter(Boolean);
  const joined = parts.join(' ');
  const pruebas = (joined.match(/\bPRUEBA\b/g) || []).length;
  if (pruebas < 2) return false;
  // Cualquier nombre con ≥2 "PRUEBA" en app/apm/nombre (casos de prueba)
  return true;
}

async function borrarAlumnoCompleto(admin, alumno) {
  const db = admin.database;
  const aid = Number(alumno.alumno_id);
  const ref = Number(alumno.alumno_ref);

  const { data: rens } = await db
    .from('becas_renovacion')
    .select('id')
    .eq('alumno_id', aid);
  for (const r of rens || []) {
    const { data: docs } = await db
      .from('becas_documento')
      .select('storage_key, storage_bucket')
      .eq('renovacion_id', r.id);
    for (const d of docs || []) {
      if (!d.storage_key) continue;
      try {
        await admin.storage
          .from(d.storage_bucket || 'becas-documentos')
          .remove(d.storage_key);
      } catch {
        /* ignore */
      }
    }
    await db.from('becas_documento').delete().eq('renovacion_id', r.id);
    await db.from('becas_hermano').delete().eq('renovacion_id', r.id);
    await db.from('becas_renovacion').delete().eq('id', r.id);
  }

  const { data: sols } = await db
    .from('becas_solicitud')
    .select('id')
    .eq('alumno_id', aid);
  for (const s of sols || []) {
    const { data: docs } = await db
      .from('becas_solicitud_documento')
      .select('storage_key, storage_bucket')
      .eq('solicitud_id', s.id);
    for (const d of docs || []) {
      if (!d.storage_key) continue;
      try {
        await admin.storage
          .from(d.storage_bucket || 'becas-documentos')
          .remove(d.storage_key);
      } catch {
        /* ignore */
      }
    }
    await db.from('becas_solicitud_documento').delete().eq('solicitud_id', s.id);
    await db.from('becas_solicitud').delete().eq('id', s.id);
  }

  await db.from('alumno_beca').delete().eq('alumno_id', aid);
  await db.from('alumno_familiar').delete().eq('alumno_id', aid);
  await db.from('alumno_detalles').delete().eq('alumno_id', aid);
  await db.from('alumno').delete().eq('alumno_id', aid);

  return { alumno_id: aid, alumno_ref: ref };
}

async function main() {
  const admin = createAdminClient({
    baseUrl: process.env.INSFORGE_URL,
    apiKey: process.env.INSFORGE_API_KEY,
  });
  const db = admin.database;

  const borrados = [];
  const vistos = new Set();

  // Por refs legacy
  for (const ref of REFS_LEGACY) {
    const { data } = await db
      .from('alumno')
      .select(
        'alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre'
      )
      .eq('alumno_ref', ref)
      .maybeSingle();
    if (!data) continue;
    if (vistos.has(Number(data.alumno_id))) continue;
    vistos.add(Number(data.alumno_id));
    borrados.push(await borrarAlumnoCompleto(admin, data));
  }

  // Por nombre con ≥2 PRUEBA (barrido amplio en refs altas de prueba)
  const { data: candidatos } = await db
    .from('alumno')
    .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre')
    .gte('alumno_ref', 29900)
    .lte('alumno_ref', 29999)
    .limit(200);

  for (const a of candidatos || []) {
    if (vistos.has(Number(a.alumno_id))) continue;
    if (!esPruebaNombre(a)) continue;
    vistos.add(Number(a.alumno_id));
    borrados.push(await borrarAlumnoCompleto(admin, a));
  }

  // También buscar ILIKE en app/nombre por si quedaron fuera del rango
  for (const campo of ['alumno_app', 'alumno_apm', 'alumno_nombre']) {
    const { data: extra } = await db
      .from('alumno')
      .select('alumno_id, alumno_ref, alumno_app, alumno_apm, alumno_nombre')
      .ilike(campo, '%PRUEBA%')
      .limit(100);
    for (const a of extra || []) {
      if (vistos.has(Number(a.alumno_id))) continue;
      if (!esPruebaNombre(a)) continue;
      vistos.add(Number(a.alumno_id));
      borrados.push(await borrarAlumnoCompleto(admin, a));
    }
  }

  // --- Alta ALAN ---
  const ahora = new Date().toISOString();
  const { data: maxRow } = await db
    .from('alumno')
    .select('alumno_id')
    .order('alumno_id', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextId = Number(maxRow?.alumno_id || 9000) + 100;

  const { data: alan, error: cErr } = await db
    .from('alumno')
    .insert([
      {
        alumno_id: nextId,
        alumno_ref: REF_ALAN,
        alumno_app: 'ALAN',
        alumno_apm: 'PRUEBA',
        alumno_nombre: 'PRUEBA',
        alumno_nivel: 3,
        alumno_grado: 3,
        alumno_grupo: 1,
        alumno_status: 1,
        alumno_nuevo_ingreso: 0,
        alumno_ciclo_escolar: cicloCalendario(),
        alumno_boleta: 0,
        mes: 0,
        secret_key: `prueba-alan-${Date.now()}`,
        motivo: 'PRUEBA',
        responsable: 'SISTEMAS',
        digito: 0,
        alumno_permiso_solicitud_beca: 0,
        alumno_solicitud_acceso_enviada: 0,
      },
    ])
    .select('alumno_id, alumno_ref')
    .single();
  if (cErr) throw new Error(`crear alan: ${cErr.message}`);

  const aid = Number(alan.alumno_id);
  const { data: maxDet } = await db
    .from('alumno_detalles')
    .select('detalle_id')
    .order('detalle_id', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextDet = Number(maxDet?.detalle_id || 10000) + 50;
  const { error: dErr } = await db.from('alumno_detalles').insert([
    { detalle_id: nextDet, alumno_id: aid, alumno_clave: CLAVE },
  ]);
  if (dErr) throw new Error(`detalles: ${dErr.message}`);

  for (const tutor_id of [1, 2]) {
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
      if (
        col.endsWith('_en') ||
        col.includes('fecha') ||
        col.includes('registro')
      ) {
        row[col] = ahora;
      } else if (col.includes('email')) {
        row[col] = EMAIL;
      } else {
        row[col] = 0;
      }
    }
    if (lastErr) throw new Error(`familiar ${tutor_id}: ${lastErr.message}`);
  }

  // Verificación: no deben quedar refs legacy ni ruben/luis/juan
  const { data: restantes } = await db
    .from('alumno')
    .select('alumno_ref, alumno_app, alumno_apm, alumno_nombre')
    .in('alumno_ref', REFS_LEGACY.filter((r) => r !== REF_ALAN));

  console.log(
    JSON.stringify(
      {
        ok: true,
        borrados,
        alan: {
          alumno_ref: REF_ALAN,
          clave: CLAVE,
          nombre: 'ALAN PRUEBA PRUEBA',
          nivel: 'Primaria 3 / A',
          alumno_id: aid,
        },
        legacy_sin_alan: restantes || [],
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
