/**
 * 2026-07-17 - Subida de PDFs de solicitud de beca (nuevo ingreso)
 * al bucket privado becas-documentos, prefijo solicitud/.
 * Tipos por catálogo nuevo (acta, CURP, etc.).
 */
import { NextRequest, NextResponse } from 'next/server';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { forbidWrongAlumno, requireAcceso } from '@/lib/acceso-auth';
import { assertPortalAbierto } from '@/lib/portal-ventanas';
import { tieneBecaActivaCicloPasado } from '@/lib/beca-elegibilidad';
import type { DocumentoTipo } from '@/lib/types';
import {
  DOCUMENTO_FLAG_COLUMN,
  TODOS_DOCUMENTO_TIPOS,
} from '@/lib/documentos-requeridos';
import { REVISION_AL_SUBIR } from '@/lib/doc-revision';

export async function POST(request: NextRequest) {
  try {
    const cerrado = assertPortalAbierto('solicitud');
    if (cerrado) {
      return NextResponse.json(cerrado, { status: 403 });
    }

    const auth = requireAcceso(request);
    if (!auth.ok) return auth.response;

    const form = await request.formData();
    const solicitudId = String(form.get('solicitud_id') || '').trim();
    const tipo = String(form.get('tipo') || '').trim() as DocumentoTipo;
    const file = form.get('file');

    if (!solicitudId) {
      return NextResponse.json({ error: 'Falta solicitud_id.' }, { status: 400 });
    }
    if (!TODOS_DOCUMENTO_TIPOS.includes(tipo)) {
      return NextResponse.json(
        { error: `Tipo de documento inválido: ${tipo}` },
        { status: 400 }
      );
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo PDF.' }, { status: 400 });
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Solo se aceptan archivos PDF.' },
        { status: 400 }
      );
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'El PDF no puede superar 10 MB.' },
        { status: 400 }
      );
    }

    const admin = getInsforgeAdmin();

    const { data: solicitud, error: solErr } = await admin.database
      .from('becas_solicitud')
      .select('id, alumno_id, enviado')
      .eq('id', solicitudId)
      .maybeSingle();

    if (solErr) {
      return NextResponse.json({ error: solErr.message }, { status: 500 });
    }
    if (!solicitud) {
      return NextResponse.json({ error: 'Solicitud no encontrada.' }, { status: 404 });
    }

    const wrong = forbidWrongAlumno(auth.acceso, solicitud.alumno_id);
    if (wrong) return wrong;

    // 2026-07-17 - Bloquear nuevas subidas si ya envió
    if (solicitud.enviado) {
      return NextResponse.json(
        {
          error:
            'Este alumno ya envió su solicitud. No se pueden modificar documentos.',
          ya_registrado: true,
        },
        { status: 409 }
      );
    }

    // Defensa: beca activa del ciclo pasado → debe ir a Renovación
    const becaCicloPasado = await tieneBecaActivaCicloPasado(
      admin.database,
      Number(solicitud.alumno_id)
    );
    if (!becaCicloPasado.ok) {
      return NextResponse.json({ error: becaCicloPasado.error }, { status: 500 });
    }
    if (becaCicloPasado.tiene) {
      return NextResponse.json(
        {
          error:
            'Este alumno tuvo beca el ciclo pasado. No se pueden subir documentos de solicitud nueva; use Renovación.',
          codigo: 'YA_TIENE_BECA',
        },
        { status: 403 }
      );
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    // 2026-07-17 - Prefijo solicitud/ para distinguir de renovación en Storage
    const storageKey = `solicitud/${solicitud.alumno_id}/${solicitudId}/${tipo}-${Date.now()}-${safeName}`;

    const { data: uploadData, error: uploadErr } = await admin.storage
      .from('becas-documentos')
      .upload(storageKey, file);

    if (uploadErr) {
      return NextResponse.json(
        { error: `Error al subir archivo: ${uploadErr.message}` },
        { status: 500 }
      );
    }

    const { data: existingDoc } = await admin.database
      .from('becas_solicitud_documento')
      .select('id, storage_key')
      .eq('solicitud_id', solicitudId)
      .eq('tipo', tipo)
      .maybeSingle();

    const docRow = {
      solicitud_id: solicitudId,
      tipo,
      storage_bucket: 'becas-documentos',
      storage_key: uploadData?.key || storageKey,
      storage_url: uploadData?.url || null,
      nombre_original: file.name,
      subido_en: new Date().toISOString(),
      ...REVISION_AL_SUBIR,
    };

    let documentoId: string;
    if (existingDoc?.id) {
      if (existingDoc.storage_key && existingDoc.storage_key !== docRow.storage_key) {
        await admin.storage.from('becas-documentos').remove(existingDoc.storage_key);
      }
      const { data: updated, error } = await admin.database
        .from('becas_solicitud_documento')
        .update(docRow)
        .eq('id', existingDoc.id)
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      documentoId = updated.id;
    } else {
      const { data: inserted, error } = await admin.database
        .from('becas_solicitud_documento')
        .insert([docRow])
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      documentoId = inserted.id;
    }

    // 2026-07-17 - Marcar checklist del tipo nuevo
    await admin.database
      .from('becas_solicitud')
      .update({ [DOCUMENTO_FLAG_COLUMN[tipo]]: true })
      .eq('id', solicitudId);

    return NextResponse.json({
      success: true,
      documento_id: documentoId,
      tipo,
      storage_key: docRow.storage_key,
      storage_url: docRow.storage_url,
      message: `Documento ${tipo} subido correctamente.`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
