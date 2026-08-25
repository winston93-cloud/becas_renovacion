/**
 * GET: PDF carta de aceptación (misma plantilla que firma electrónica, sin firma).
 * Query: flujo, expediente_id
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertNivelPermitido, requireAdmin } from '@/lib/admin-auth';
import { getInsforgeAdmin } from '@/lib/insforge-server';
import { construirCartaAceptacionPayload } from '@/lib/carta-aceptacion-payload';

function serviciosAdminUrl(): string {
  return (
    process.env.SERVICIOS_ADMIN_URL?.trim() ||
    'https://servicios-admin.vercel.app'
  ).replace(/\/$/, '');
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const flujo = request.nextUrl.searchParams.get('flujo')?.trim() || '';
    const expedienteId =
      request.nextUrl.searchParams.get('expediente_id')?.trim() || '';

    if (!expedienteId || (flujo !== 'renovacion' && flujo !== 'solicitud')) {
      return NextResponse.json(
        { error: 'Parámetros inválidos (flujo, expediente_id).' },
        { status: 400 }
      );
    }

    const db = getInsforgeAdmin();
    const parentTable =
      flujo === 'renovacion' ? 'becas_renovacion' : 'becas_solicitud';
    const { data: parent } = await db.database
      .from(parentTable)
      .select('alumno_id')
      .eq('id', expedienteId)
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

    const built = await construirCartaAceptacionPayload({
      flujo: flujo as 'solicitud' | 'renovacion',
      expedienteId,
    });
    if (!built.ok) {
      return NextResponse.json({ error: built.error }, { status: 400 });
    }

    const secret = process.env.BECAS_CARTA_PREVIEW_SECRET?.trim();
    if (!secret) {
      return NextResponse.json(
        {
          error:
            'Falta BECAS_CARTA_PREVIEW_SECRET en el servidor (becas + servicios_admin).',
        },
        { status: 500 }
      );
    }

    const pdfRes = await fetch(
      `${serviciosAdminUrl()}/api/firma-electronica/carta-beca`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify(built.data),
        cache: 'no-store',
      }
    );

    if (!pdfRes.ok) {
      let detail = 'No se pudo generar la carta PDF.';
      try {
        const errJson = await pdfRes.json();
        if (errJson?.error) detail = String(errJson.error);
      } catch {
        /* respuesta no JSON */
      }
      return NextResponse.json({ error: detail }, { status: 502 });
    }

    const pdfBytes = await pdfRes.arrayBuffer();
    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="carta-aceptacion-beca.pdf"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Error al generar carta.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
