/**
 * One-shot: borra JUAN PRUEBA (29901) y crea LUIS PRUEBA (29902)
 * con renovación enviada + 4 PDFs apócrifos.
 *
 * Uso: node --env-file=.env.local scripts/seed-luis-prueba-renovacion.mjs
 */
import { createAdminClient } from '@insforge/sdk';

const REF_JUAN = 29901;
const REF_LUIS = 29902;
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

/** PDF mínimo válido (1 página en blanco con texto en comment). */
function makeFakePdf(titulo) {
  const safe = String(titulo).replace(/[()\\]/g, ' ').slice(0, 80);
  const content = `BT /F1 12 Tf 50 750 Td (${safe} - PRUEBA LUIS ${REF_LUIS}) Tj ET`;
  const objects = [];
  objects.push('1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n');
  objects.push('2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n');
  objects.push(
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj\n'
  );
  objects.push(
    `4 0 obj<< /Length ${content.length} >>stream\n${content}\nendstream\nendobj\n`
  );
  objects.push(
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n'
  );

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj;
  }
  const xrefPos = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefPos}\n%%EOF\n`;
  return Buffer.from(pdf, 'utf8');
}

async function main() {
  const baseUrl = process.env.INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!baseUrl || !apiKey) throw new Error('Faltan INSFORGE_URL / INSFORGE_API_KEY');

  const admin = createAdminClient({ baseUrl, apiKey });
  const db = admin.database;
  const origen = cicloOrigen();
  const ahora = new Date().toISOString();

  // --- Borrar Juan ---
  const { data: juan } = await db
    .from('alumno')
    .select('alumno_id, alumno_ref')
    .eq('alumno_ref', REF_JUAN)
    .maybeSingle();

  if (juan?.alumno_id) {
    const jid = Number(juan.alumno_id);
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
    await db.from('alumno_beca').delete().eq('alumno_id', jid);
    await db.from('alumno_familiar').delete().eq('alumno_id', jid);
    await db.from('alumno_detalles').delete().eq('alumno_id', jid);
    await db.from('alumno').delete().eq('alumno_id', jid);
    console.log('Borrado JUAN PRUEBA ref', REF_JUAN, 'id', jid);
  } else {
    console.log('JUAN 29901 no encontrado (ok)');
  }

  // --- Upsert Luis ---
  let { data: luis } = await db
    .from('alumno')
    .select('alumno_id, alumno_ref')
    .eq('alumno_ref', REF_LUIS)
    .maybeSingle();

  if (!luis) {
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
          alumno_ref: REF_LUIS,
          alumno_app: 'LUIS',
          alumno_apm: 'PRUEBA',
          alumno_nombre: 'PRUEBA',
          alumno_nivel: 4,
          alumno_grado: 1,
          alumno_grupo: 1,
          alumno_status: 1,
          alumno_nuevo_ingreso: 0,
          alumno_ciclo_escolar: cicloCalendario(),
          alumno_boleta: 0,
          mes: 0,
          secret_key: `prueba-luis-${Date.now()}`,
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
    luis = created;
    console.log('Creado LUIS', luis);
  } else {
    await db
      .from('alumno')
      .update({
        alumno_app: 'LUIS',
        alumno_apm: 'PRUEBA',
        alumno_nombre: 'PRUEBA',
        alumno_nivel: 4,
        alumno_grado: 1,
        alumno_grupo: 1,
        alumno_status: 1,
        alumno_permiso_solicitud_beca: 0,
        alumno_solicitud_acceso_enviada: 0,
      })
      .eq('alumno_id', luis.alumno_id);
    console.log('Actualizado LUIS existente', luis);
  }

  const aid = Number(luis.alumno_id);

  // clave
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

  // familiares (correo prueba)
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
      await db
        .from('alumno_familiar')
        .update(row)
        .eq('familiar_id', fam.familiar_id);
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

  // beca ciclo origen (para renovación)
  const { data: becaExist } = await db
    .from('alumno_beca')
    .select('alumno_beca_id')
    .eq('alumno_id', aid)
    .eq('beca_ciclo_escolar', origen)
    .maybeSingle();
  const becaRow = {
    alumno_id: aid,
    alumno_ref: REF_LUIS,
    beca_id: 9,
    beca_porcentaje: 25,
    beca_estatus: 1,
    beca_ciclo_escolar: origen,
    beca_registro: ahora,
    beca_actualizacion: ahora,
    beca_p: '0',
  };
  if (becaExist?.alumno_beca_id) {
    await db
      .from('alumno_beca')
      .update(becaRow)
      .eq('alumno_beca_id', becaExist.alumno_beca_id);
  } else {
    const { error } = await db.from('alumno_beca').insert([becaRow]);
    if (error) throw new Error(`alumno_beca: ${error.message}`);
  }

  // renovación enviada
  let { data: ren } = await db
    .from('becas_renovacion')
    .select('id')
    .eq('alumno_id', aid)
    .eq('ciclo_escolar', origen)
    .maybeSingle();

  const renPatch = {
    alumno_id: aid,
    ciclo_escolar: origen,
    motivo: 'FAMILIA DE PRUEBA — renovación de beca (expediente de prueba)',
    casa_tipo: 'propia',
    otra_beca: false,
    observaciones: 'Expediente de prueba LUIS PRUEBA',
    correo_enviado: true,
    correo_enviado_en: ahora,
    verificado: false,
    fecha_verificado: null,
    beca_autorizada: false,
    ingresos: true,
    domicilio: true,
    boleta: true,
    comp_inscripcion: true,
  };

  if (ren?.id) {
    await db.from('becas_renovacion').update(renPatch).eq('id', ren.id);
  } else {
    const { data: created, error } = await db
      .from('becas_renovacion')
      .insert([renPatch])
      .select('id')
      .single();
    if (error) throw new Error(`renovacion: ${error.message}`);
    ren = created;
  }

  const renId = ren.id;
  const tipos = [
    ['ingresos', 'COMPROBANTE_INGRESOS_PRUEBA.pdf'],
    ['domicilio', 'COMPROBANTE_DOMICILIO_PRUEBA.pdf'],
    ['boleta', 'BOLETA_PRUEBA.pdf'],
    ['comp_inscripcion', 'RECIBO_INSCRIPCION_PRUEBA.pdf'],
  ];

  for (const [tipo, nombre] of tipos) {
    const pdf = makeFakePdf(nombre.replace('.pdf', ''));
    const storageKey = `${aid}/${renId}/${tipo}-prueba-${Date.now()}.pdf`;
    const { data: up, error: upErr } = await admin.storage
      .from('becas-documentos')
      .upload(storageKey, pdf, { contentType: 'application/pdf' });
    if (upErr) {
      // algunos SDKs quieren File/Blob
      const blob = new Blob([pdf], { type: 'application/pdf' });
      const retry = await admin.storage
        .from('becas-documentos')
        .upload(storageKey, blob, { contentType: 'application/pdf' });
      if (retry.error) throw new Error(`upload ${tipo}: ${retry.error.message}`);
    }

    const docRow = {
      renovacion_id: renId,
      tipo,
      storage_bucket: 'becas-documentos',
      storage_key: up?.key || storageKey,
      storage_url: up?.url || null,
      nombre_original: nombre,
      subido_en: ahora,
      revision_estado: 'pendiente',
      revision_nota: null,
      revisado_en: null,
      revisado_por: null,
    };

    const { data: existing } = await db
      .from('becas_documento')
      .select('id, storage_key')
      .eq('renovacion_id', renId)
      .eq('tipo', tipo)
      .maybeSingle();

    if (existing?.id) {
      if (existing.storage_key && existing.storage_key !== docRow.storage_key) {
        try {
          await admin.storage
            .from('becas-documentos')
            .remove(existing.storage_key);
        } catch {
          /* ignore */
        }
      }
      const { error } = await db
        .from('becas_documento')
        .update(docRow)
        .eq('id', existing.id);
      if (error) throw new Error(`doc update ${tipo}: ${error.message}`);
    } else {
      const { error } = await db.from('becas_documento').insert([docRow]);
      if (error) throw new Error(`doc insert ${tipo}: ${error.message}`);
    }
    console.log('PDF', tipo, 'ok');
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        alumno: 'LUIS PRUEBA PRUEBA',
        alumno_ref: REF_LUIS,
        clave: CLAVE,
        email_prueba: EMAIL,
        renovacion_id: renId,
        ciclo_origen: origen,
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
