/**
 * 2026-10-09 - Beca SEP: constancia PDF de la aplicación (la misma que se adjunta en el correo a la familia).
 */
import { NextResponse } from 'next/server';
import { requireAdminSep } from '@/lib/sep/admin';
import { constanciaSepPdf } from '@/lib/sep/constancia';
import { respuestaError } from '@/lib/sep/http';
import { obtenerSep } from '@/lib/sep/servicio';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSep();
  if (!auth.ok) return auth.response;
  try {
    const s = await obtenerSep(auth.admin, (await params).id);
    if (s.estado !== 'aplicada' || !s.calculo) return NextResponse.json({ error: 'La beca aún no está aplicada.' }, { status: 409 });
    const pdf = await constanciaSepPdf(s);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Constancia-Beca-SEP-${s.alumnoRef}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    return respuestaError(err, 'GET /api/admin/sep/[id]/constancia');
  }
}
