/**
 * 2026-10-07 - Beca SEP: ver el documento subido por la familia (por defecto el vigente).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSep } from '@/lib/sep/admin';
import { respuestaError } from '@/lib/sep/http';
import { documentoVigente, obtenerSep } from '@/lib/sep/servicio';
import { getSepRepo } from '@/lib/sep/repo';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSep();
  if (!auth.ok) return auth.response;
  try {
    const s = await obtenerSep(auth.admin, (await params).id);
    const docId = request.nextUrl.searchParams.get('doc');
    const doc = docId ? s.documentos.find((d) => d.id === docId) : documentoVigente(s);
    if (!doc) return NextResponse.json({ error: 'Sin documento.' }, { status: 404 });
    const bytes = await getSepRepo().leerArchivo(doc.clave);
    const nombre = doc.nombreOriginal.replace(/[^a-zA-Z0-9._-]/g, '_');
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': doc.tipo,
        'Content-Disposition': `inline; filename="${nombre}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    return respuestaError(err, 'GET /api/admin/sep/[id]/documento');
  }
}
