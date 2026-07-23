/**
 * 2026-07-16 - ETL MySQL winston_general → InsForge (tablas becas_*).
 *
 * Uso:
 *   1. Exporta las tablas desde MySQL (phpMyAdmin / mysqldump) a JSON:
 *        alumno, alumno_detalles, alumno_familiar, alumno_beca
 *      Coloca los archivos en scripts/data/ como:
 *        alumno.json, alumno_detalles.json, alumno_familiar.json, alumno_beca.json
 *   2. Configura .env.local con INSFORGE_URL e INSFORGE_API_KEY
 *   3. npx tsx scripts/migrate-mysql-to-insforge.ts
 *
 * Formato esperado por archivo: array de objetos con las columnas legacy.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { createAdminClient } from '@insforge/sdk';

type JsonRow = Record<string, unknown>;

function loadJson(name: string): JsonRow[] {
  const path = resolve(process.cwd(), 'scripts/data', name);
  if (!existsSync(path)) {
    console.warn(`⚠ No se encontró ${path} — se omite.`);
    return [];
  }
  const raw = readFileSync(path, 'utf8');
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) {
    throw new Error(`${name} debe ser un array JSON.`);
  }
  return data;
}

function str(v: unknown): string {
  if (v == null) return '';
  return String(v).trim();
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function boolFromLegacy(v: unknown): boolean | null {
  if (v == null || v === '') return null;
  if (typeof v === 'boolean') return v;
  const s = String(v).toLowerCase();
  if (['1', 'si', 'sí', 'true', 'y', 'yes'].includes(s)) return true;
  if (['0', 'no', 'false', 'n'].includes(s)) return false;
  return null;
}

async function main() {
  const baseUrl = process.env.INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) {
    throw new Error('Configura INSFORGE_URL e INSFORGE_API_KEY antes de migrar.');
  }

  const admin = createAdminClient({ baseUrl, apiKey });

  const alumnos = loadJson('alumno.json');
  const detalles = loadJson('alumno_detalles.json');
  const familiares = loadJson('alumno_familiar.json');
  const becas = loadJson('alumno_beca.json');

  console.log(`Alumnos: ${alumnos.length}`);
  console.log(`Detalles: ${detalles.length}`);
  console.log(`Familiares: ${familiares.length}`);
  console.log(`Becas: ${becas.length}`);

  // Mapa legacy_alumno_id → uuid InsForge
  const idMap = new Map<number, string>();

  // --- Alumnos ---
  let ok = 0;
  let fail = 0;
  for (const a of alumnos) {
    const legacyId = num(a.alumno_id);
    const alumnoRef = str(a.alumno_ref);
    if (!legacyId || !alumnoRef) {
      fail++;
      continue;
    }

    const row = {
      alumno_ref: alumnoRef,
      alumno_app: str(a.alumno_app),
      alumno_apm: str(a.alumno_apm),
      alumno_nombre: str(a.alumno_nombre),
      alumno_nivel: num(a.alumno_nivel),
      alumno_grado: num(a.alumno_grado),
      alumno_grupo: str(a.alumno_grupo) || null,
      alumno_ciclo_escolar: num(a.alumno_ciclo_escolar),
      alumno_status: num(a.alumno_status) ?? 1,
      legacy_alumno_id: legacyId,
    };

    const { data: existing } = await admin.database
      .from('becas_alumno')
      .select('id')
      .eq('alumno_ref', alumnoRef)
      .maybeSingle();

    let uuid: string;
    if (existing?.id) {
      await admin.database.from('becas_alumno').update(row).eq('id', existing.id);
      uuid = existing.id;
    } else {
      const { data: inserted, error } = await admin.database
        .from('becas_alumno')
        .insert([row])
        .select('id')
        .single();
      if (error || !inserted) {
        console.error(`Alumno ${alumnoRef}:`, error?.message);
        fail++;
        continue;
      }
      uuid = inserted.id;
    }
    idMap.set(legacyId, uuid);
    ok++;
  }
  console.log(`✓ Alumnos migrados: ${ok}, fallidos: ${fail}`);

  // --- Detalles ---
  ok = 0;
  fail = 0;
  for (const d of detalles) {
    const legacyId = num(d.alumno_id);
    if (!legacyId || !idMap.has(legacyId)) {
      fail++;
      continue;
    }
    const alumnoId = idMap.get(legacyId)!;
    const row = {
      alumno_id: alumnoId,
      alumno_clave: str(d.alumno_clave) || null,
      alumno_calle: str(d.alumno_calle) || null,
      alumno_numero: str(d.alumno_numero) || null,
      alumno_colonia: str(d.alumno_colonia) || null,
      alumno_cp: str(d.alumno_cp) || null,
      alumno_curp: str(d.alumno_curp) || null,
      alumno_fecha_nac: str(d.alumno_fecha_nac) || null,
    };

    const { data: existing } = await admin.database
      .from('becas_alumno_detalle')
      .select('id')
      .eq('alumno_id', alumnoId)
      .maybeSingle();

    if (existing?.id) {
      await admin.database.from('becas_alumno_detalle').update(row).eq('id', existing.id);
    } else {
      const { error } = await admin.database.from('becas_alumno_detalle').insert([row]);
      if (error) {
        console.error(`Detalle ${legacyId}:`, error.message);
        fail++;
        continue;
      }
    }
    ok++;
  }
  console.log(`✓ Detalles migrados: ${ok}, fallidos: ${fail}`);

  // --- Familiares ---
  ok = 0;
  fail = 0;
  for (const f of familiares) {
    const legacyId = num(f.alumno_id);
    const tutorId = num(f.tutor_id);
    if (!legacyId || !idMap.has(legacyId) || (tutorId !== 1 && tutorId !== 2)) {
      fail++;
      continue;
    }
    const alumnoId = idMap.get(legacyId)!;
    const row = {
      alumno_id: alumnoId,
      tutor_id: tutorId,
      familiar_app: str(f.familiar_app),
      familiar_apm: str(f.familiar_apm),
      familiar_nombre: str(f.familiar_nombre),
      familiar_vive: boolFromLegacy(f.familiar_vive),
      familiar_escolaridad: str(f.familiar_escolaridad) || null,
      familiar_empresa_nombre: str(f.familiar_empresa_nombre) || null,
      familiar_empresa_puesto: str(f.familiar_empresa_puesto) || null,
      familiar_tel: str(f.familiar_tel) || null,
      familiar_cel: str(f.familiar_cel) || null,
      familiar_email: str(f.familiar_email) || null,
    };

    const { data: existing } = await admin.database
      .from('becas_familiar')
      .select('id')
      .eq('alumno_id', alumnoId)
      .eq('tutor_id', tutorId)
      .maybeSingle();

    if (existing?.id) {
      await admin.database.from('becas_familiar').update(row).eq('id', existing.id);
    } else {
      const { error } = await admin.database.from('becas_familiar').insert([row]);
      if (error) {
        console.error(`Familiar ${legacyId}/${tutorId}:`, error.message);
        fail++;
        continue;
      }
    }
    ok++;
  }
  console.log(`✓ Familiares migrados: ${ok}, fallidos: ${fail}`);

  // --- Becas ---
  ok = 0;
  fail = 0;
  for (const b of becas) {
    const legacyId = num(b.alumno_id);
    const becaId = num(b.beca_id);
    const ciclo = num(b.beca_ciclo_escolar);
    if (!legacyId || !idMap.has(legacyId) || !becaId || !ciclo) {
      fail++;
      continue;
    }
    const alumnoId = idMap.get(legacyId)!;
    const row = {
      alumno_id: alumnoId,
      beca_id: becaId,
      beca_porcentaje: num(b.beca_porcentaje) ?? 0,
      beca_estatus: num(b.beca_estatus) ?? 1,
      beca_ciclo_escolar: ciclo,
    };

    const { data: existing } = await admin.database
      .from('becas_alumno_beca')
      .select('id')
      .eq('alumno_id', alumnoId)
      .eq('beca_ciclo_escolar', ciclo)
      .maybeSingle();

    if (existing?.id) {
      await admin.database.from('becas_alumno_beca').update(row).eq('id', existing.id);
    } else {
      const { error } = await admin.database.from('becas_alumno_beca').insert([row]);
      if (error) {
        console.error(`Beca ${legacyId}/${ciclo}:`, error.message);
        fail++;
        continue;
      }
    }
    ok++;
  }
  console.log(`✓ Becas migradas: ${ok}, fallidos: ${fail}`);
  console.log('Migración finalizada.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
