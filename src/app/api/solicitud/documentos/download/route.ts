/**
 * 2026-07-17 - Descarga de PDF de solicitud con token HMAC (enlaces del correo).
 * 2026-07-23 - Restaurado desde backup; tabla becas_solicitud_documento.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { verifyDocLink } from '@/lib/doc-download-token';

export async function GET(request: NextRequest) {
  try {
    const token = (request.nextUrl.searchParams.get('token') || '').trim();
    if (!token) {
      return NextResponse.json({ error: 'Falta token.' }, { status: 400 });
    }

    const payload = verifyDocLink(token);
    if (!payload) {
      return NextResponse.json(
        { error: 'Token inválido o expirado.' },
        { status: 403 }
      );
    }

    const admin = getInsforgeAdmin();
    const { data: doc, error: docErr } = await admin.database
      .from('becas_solicitud_documento')
      .select('id, tipo, storage_key, storage_bucket, nombre_original')
      .eq('id', payload.documentoId)
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

    const bucket = doc.storage_bucket || 'becas-documentos';
    const { data: fileData, error: dlErr } = await admin.storage
      .from(bucket)
      .download(doc.storage_key);

    if (dlErr || !fileData) {
      return NextResponse.json(
        {
          error: `No se pudo descargar el archivo: ${dlErr?.message || 'sin datos'}`,
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

    return new NextResponse(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${safeName}"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al descargar documento.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
