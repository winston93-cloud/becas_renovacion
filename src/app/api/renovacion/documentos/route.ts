/**
 * 2026-07-16 - Subida de PDFs de renovación al bucket privado becas-documentos.
 * 2026-07-17 - Tipos por catálogo nuevo (acta, CURP, etc.).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { forbidWrongAlumno, requireAcceso } from '@/lib/acceso-auth';
import { assertPortalAbierto } from '@/lib/portal-ventanas';
import type { DocumentoTipo } from '@/lib/types';
import {
  DOCUMENTO_FLAG_COLUMN,
  TODOS_DOCUMENTO_TIPOS,
} from '@/lib/documentos-requeridos';
import { REVISION_AL_REENVIAR, REVISION_AL_SUBIR } from '@/lib/doc-revision';

export async function POST(request: NextRequest) {
  try {
    const cerrado = assertPortalAbierto('renovacion');
    if (cerrado) {
      return NextResponse.json(cerrado, { status: 403 });
    }

    // 2026-07-22 - Sesión familiar requerida
    const auth = requireAcceso(request);
    if (!auth.ok) return auth.response;

    const form = await request.formData();
    const renovacionId = String(form.get('renovacion_id') || '').trim();
    const tipo = String(form.get('tipo') || '').trim() as DocumentoTipo;
    const file = form.get('file');

    if (!renovacionId) {
      return NextResponse.json({ error: 'Falta renovacion_id.' }, { status: 400 });
    }
    if (!TODOS_DOCUMENTO_TIPOS.includes(tipo)) {
      return NextResponse.json({ error: `Tipo de documento inválido: ${tipo}` }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo PDF.' }, { status: 400 });
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Solo se aceptan archivos PDF.' }, { status: 400 });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'El PDF no puede superar 10 MB.' }, { status: 400 });
    }

    const admin = getInsforgeAdmin();

    const { data: renovacion, error: renErr } = await admin.database
      .from('becas_renovacion')
      .select('id, alumno_id, correo_enviado')
      .eq('id', renovacionId)
      .maybeSingle();

    if (renErr) {
      return NextResponse.json({ error: renErr.message }, { status: 500 });
    }
    if (!renovacion) {
      return NextResponse.json({ error: 'Renovación no encontrada.' }, { status: 404 });
    }

    const wrong = forbidWrongAlumno(auth.acceso, renovacion.alumno_id);
    if (wrong) return wrong;

    // Bloquear subidas si ya finalizó, salvo corrección de documentos incorrectos
    const { data: existingDoc } = await admin.database
      .from('becas_documento')
      .select('id, storage_key, revision_estado')
      .eq('renovacion_id', renovacionId)
      .eq('tipo', tipo)
      .maybeSingle();

    const esCorreccion =
      Boolean(renovacion.correo_enviado) &&
      existingDoc?.revision_estado === 'incorrecto';

    if (renovacion.correo_enviado && !esCorreccion) {
      return NextResponse.json(
        {
          error:
            'Este alumno ya finalizó su renovación. Solo puede reemplazar documentos marcados como incorrectos.',
          ya_registrado: true,
        },
        { status: 409 }
      );
    }

    // 2026-07-16 - alumno_id es integer (FK a public.alumno)
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `${renovacion.alumno_id}/${renovacionId}/${tipo}-${Date.now()}-${safeName}`;

    const { data: uploadData, error: uploadErr } = await admin.storage
      .from('becas-documentos')
      .upload(storageKey, file);

    if (uploadErr) {
      return NextResponse.json(
        { error: `Error al subir archivo: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    const revisionPatch = esCorreccion
      ? REVISION_AL_REENVIAR
      : REVISION_AL_SUBIR;

    const docRow = {
      renovacion_id: renovacionId,
      tipo,
      storage_bucket: 'becas-documentos',
      storage_key: uploadData?.key || storageKey,
      storage_url: uploadData?.url || null,
      nombre_original: file.name,
      subido_en: new Date().toISOString(),
      ...revisionPatch,
    };

    let documentoId: string;
    if (existingDoc?.id) {
      // Borrar objeto anterior si existe
      if (existingDoc.storage_key && existingDoc.storage_key !== docRow.storage_key) {
        await admin.storage.from('becas-documentos').remove(existingDoc.storage_key);
      }
      const { data: updated, error } = await admin.database
        .from('becas_documento')
        .update(docRow)
        .eq('id', existingDoc.id)
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      documentoId = updated.id;
    } else {
      const { data: inserted, error } = await admin.database
        .from('becas_documento')
        .insert([docRow])
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      documentoId = inserted.id;
    }

    // 2026-07-17 - Marcar checklist del tipo nuevo
    await admin.database
      .from('becas_renovacion')
      .update({ [DOCUMENTO_FLAG_COLUMN[tipo]]: true })
      .eq('id', renovacionId);

    return NextResponse.json({
      success: true,
      documento_id: documentoId,
      tipo,
      storage_key: docRow.storage_key,
      storage_url: docRow.storage_url,
      revision_estado: revisionPatch.revision_estado,
      message: `Documento ${tipo} subido correctamente.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
