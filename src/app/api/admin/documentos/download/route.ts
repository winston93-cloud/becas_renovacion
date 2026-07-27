/**
 * Descarga/vista de PDF para Control Escolar (sesión admin).
 * GET ?flujo=renovacion|solicitud&id=<documento_uuid>
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertNivelPermitido, requireAdmin } from '@/lib/admin-auth';
import { getInsforgeAdmin } from '@/lib/insforge-server';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const flujo = (request.nextUrl.searchParams.get('flujo') || '').trim();
    const docId = (request.nextUrl.searchParams.get('id') || '').trim();
    if (!docId || (flujo !== 'renovacion' && flujo !== 'solicitud')) {
      return NextResponse.json(
        { error: 'Parámetros inválidos (flujo, id).' },
        { status: 400 }
      );
    }

    const db = getInsforgeAdmin();
    const tabla =
      flujo === 'renovacion' ? 'becas_documento' : 'becas_solicitud_documento';
    const fk = flujo === 'renovacion' ? 'renovacion_id' : 'solicitud_id';

    const { data: doc, error: docErr } = await db.database
      .from(tabla)
      .select(
        `id, tipo, storage_key, storage_bucket, nombre_original, ${fk}`
      )
      .eq('id', docId)
      .maybeSingle();

    if (docErr) {
      return NextResponse.json({ error: docErr.message }, { status: 500 });
    }
    if (!doc) {
      return NextResponse.json(
        { error: 'Documento no encontrado.' },
        { status: 404 }
      );
    }

    const parentId = String(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      flujo === 'renovacion' ? (doc as any).renovacion_id : (doc as any).solicitud_id
    );
    const parentTable =
      flujo === 'renovacion' ? 'becas_renovacion' : 'becas_solicitud';

    const { data: parent } = await db.database
      .from(parentTable)
      .select('alumno_id')
      .eq('id', parentId)
      .maybeSingle();

    if (!parent) {
      return NextResponse.json(
        { error: 'Expediente no encontrado.' },
        { status: 404 }
      );
    }

    const { data: alumno } = await db.database
      .from('alumno')
      .select('alumno_nivel')
      .eq('alumno_id', Number(parent.alumno_id))
      .maybeSingle();

    const forbid = assertNivelPermitido(auth.admin, alumno?.alumno_nivel);
    if (forbid) return forbid;

    const bucket = doc.storage_bucket || 'becas-documentos';
    const { data: fileData, error: dlErr } = await db.storage
      .from(bucket)
      .download(doc.storage_key);

    if (dlErr || !fileData) {
      return NextResponse.json(
        {
          error: `No se pudo descargar: ${dlErr?.message || 'sin datos'}`,
        },
        { status: 500 }
      );
    }

    const bytes = new Uint8Array(await fileData.arrayBuffer());
    const safeName =
      (doc.nombre_original || `${doc.tipo}.pdf`).replace(
        /[^a-zA-Z0-9._-]/g,
        '_'
      ) || `${doc.tipo}.pdf`;

    const disposition =
      request.nextUrl.searchParams.get('download') === '1'
        ? `attachment; filename="${safeName}"`
        : `inline; filename="${safeName}"`;

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al abrir documento.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
